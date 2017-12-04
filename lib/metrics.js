/**
 * Time series database to store metrics.
 *
 * A metric is an immutable map with the following keys:
 *
 *  time    int      required    Number of seconds since UNIx epoch.
 *  name    string   required    Name of the time series this metric belongs to.
 *  value   number   required    Value of the metric
 *  tags    map      optional    Tags associated to this metric (indexed)
 */

const { fromJS, Set, Map, isKeyed } = require('immutable')
const { iso } = require('./util')
const { read, write } = require('./persist')

// A time series is identified by a name and a set of named tags.
function seriesFor (metric) {
  return metric
    .get('tags', Map())
    .set('__name', metric.get('name'))
    .filter(v => v !== undefined)
}

// Encode series as string
function encode (series) {
  return series
    .entrySeq()
    .sort()
    .map(p => p.join(':'))
    .join(',')
}

// merge two sorted set of data
function mergeWith (merge, d1, d2) {
  const l1 = d1.length
  const l2 = d2.length
  let c1 = 0
  let c2 = 0
  const result = []
  while (c1 < l1 || c2 < l2) {
    if (c1 === l1) {
      result.push(...d2.slice(c2))
      return result
    }
    if (c2 === l2) {
      result.push(...d1.slice(c1))
      return result
    }
    if (d1[c1][0] === d2[c2][0]) {
      result.push([d1[c1][0], merge(d1[c1][1], d2[c2][1])])
      c1++
      c2++
    } else if (d1[c1][0] < d2[c2][0]) {
      result.push(d1[c1])
      c1++
    } else {
      result.push(d2[c2])
      c2++
    }
  }
  return result
}

// insert the point in data, keeping it sorted
// this is efficient if the points comes in increasing order
function insertOrReplacePoint (data, time, value) {
  const lastIndex = data.length - 1
  if (lastIndex === -1 || data[lastIndex][0] < time) {
    data.push([time, value])
  } else {
    for (var i = lastIndex; i >= 0; i--) {
      if (data[i][0] < time) {
        data.splice(i + 1, 0, [time, value])
        return
      } else if (data[i][0] === time) {
        if (data[i][1] > value) {
          console.log('Warning: Overwriting metric at', time, 'with a lower value.')
        }
        data[i][1] = value
        return
      }
    }
    data.unshift([time, value])
  }
}

function filter (start, end) {
  if (start && end) {
    return ([t, v]) => (t >= start && t < end)
  }
  if (start) {
    return ([t, v]) => (t >= start)
  }
  if (end) {
    return ([t, v]) => (t < end)
  }
}

function aggregate (data, start, end, step) {
  if (data.length === 0) {
    return data
  }
  const size = data.length
  start = data[0][0] - data[0][0] % step
  end = data[size - 1][0] - data[size - 1][0] % step
  const res = []
  let c = 0
  for (var i = start; i <= end; i += step) {
    let total = 0
    while (c < size) {
      if (data[c][0] < i + step) {
        total += data[c][1]
        c++
      } else {
        break
      }
    }
    res.push([i, total])
  }
  return res
}

// Return data in [start, end[ for each step
function filterAndAggregate (data, start, end, step) {
  step = step || 1
  const f = filter(start, end)
  if (f) { data = data.filter(f) }
  return aggregate(data, start, end, step)
}

// Remove all points older than `cutoff`, retur number of removed elements
function gcPoints (points, cutoff) {
  const l = points.length
  for (var i = 0; i < l; i++) {
    if (points[i][0] >= cutoff) {
      return points.splice(0, i).length
    }
  }
  if (i === l) {
    points.splice(0, l)
    return l
  }
  return 0
}

// Garbage collect old points
function gc (data, deleteAfter) {
  // time horizon is biggest timestamp in database
  const timeSeries = Object.values(data)
  if (timeSeries.length > 0) {
    const now = Math.max.apply(null, timeSeries.map(a => (a.length) ? a[a.length - 1][0] : 0))
    const cutoff = now - deleteAfter
    console.log('Garbage collecting events older than', iso(cutoff))
    const total = timeSeries
          .map(points => gcPoints(points, cutoff))
          .reduce((a, b) => a + b, 0)
    console.log('Deleted', total, 'points.')
  }
}

class Database {
  /**
   * Create a new in-memory time series database.
   */
  constructor ({deleteAfter = 24 * 3600, persist = true} = {}) {
    this.persist = persist
    if (this.persist) {
      const data = read('metrics')
      if (data) {
        this.series = data.series
        this.indices = fromJS(data.indices,
                              function (key, value) {
                                return isKeyed(value) ? value.toMap() : value.toSet()
                              })
      }
    }
    if (!this.series) {
      this.series = {}     // contains the points indexed by series
      this.indices = Map() // index the series by tags
    }
    this.gc = setInterval(function () {
      gc(this.series, deleteAfter)
    }.bind(this), 3600 * 1000)
  }

  /**
   * Free any opened resources and finish background tasks.
   */
  close () {
    if (this.persist) {
      write('metrics', {
        series: this.series,
        indices: this.indices
      })
    }
    clearInterval(this.gc)
  }

  /**
   * Add a metric to the store
   */
  add (metric) {
    const series = seriesFor(metric)
    const s = encode(series)
    if (!this.series[s]) {
      // create the time series
      this.series[s] = []
      // and index it
      this.indices = series.entrySeq().reduce((indices, e) => {
        return indices.updateIn(e, Set(), seriesSet => seriesSet.add(s))
      }, this.indices)
    }
    insertOrReplacePoint(this.series[s], metric.get('time'), metric.get('value'))
    return metric
  }

  /**
   * Query metrics
   *
   * The query map accepts the following keys:
   *
   * To specify the time series:
   *    name     string   required  The name of the time series
   *
   * To filter time series:
   *    tags     map      optional  Set of tags for exact match (TODO: wildcards?)
   *
   * To specify the time range:
   *    start    int      optional  Seconds since Unix  epoch. Lower time bound (inclusive)
   *    end      int      optional  Upper time bound (exclusive)
   *
   * To group by time interval:
   *    step     int      optional  Interval in seconds
   *
   * To group results by tag:
   *    by       string   optional  A tag's value.
   */
  query (query) {
    // Find the series we need to query
    let seriesSet = Set.intersect(seriesFor(query).entrySeq().map(e => Set(this.indices.getIn(e, []))))
    let points = []
    if (query.has('by')) {
      // Query a set of series for each known value of the tag
      points = this.indices
        .get(query.get('by'), Map())
        .map(function (s) { return this.querySeriesSet(query, Set.intersect([s, seriesSet])) }.bind(this))
        .map((data, tag) => data.map(([t, v]) => {
          let m = Map()
          if (v !== 0) {
            m = m.set(tag, v)
          }
          return [t, m]
        }))
        .reduce((results, data) => {
          return mergeWith((a, b) => a.merge(b), results, data)
        }, [])
        .map(([t, v]) => [t, v.toJS()])
    } else {
      // no by -> set of series
      points = this.querySeriesSet(query, seriesSet)
    }
    return points
  }

  // query a set of series
  querySeriesSet (query, seriesSet) {
    return seriesSet
      .valueSeq()
      .map(s => filterAndAggregate(this.series[s], query.get('start'), query.get('end'), query.get('step')))
      .reduce((results, data) => mergeWith((a, b) => a + b, results, data), [])
  }

  encodeSeries (m) {
    return encode(seriesFor(m))
  }
}

const databases = {}

function createDatabase (name, options) {
  if (databases[name]) {
    throw new Error('A database with the same name already exists.')
  }
  databases[name] = new Database(options)
  return databases[name]
}

module.exports = {
  createDatabase: (name, options) => createDatabase(name, options),
  getDatabase: (name) => databases[name]
}
