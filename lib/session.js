/**
 * Database of user and bot sessions.
 */

const { Map, Repeat, List } = require('immutable')
const { iso, now } = require('./util')

/**
 * Helper to compute session speed.
 */
class Speed {
  constructor (size) {
    this.size = size
    this.counters = []
  }

  // count the request for the given `time`
  hit (time) {
    const cutoff = now() - this.size * 60
    this.counters = this.counters.filter(([t, v]) => t >= cutoff)
    const lastIndex = this.counters.length - 1
    if (lastIndex === -1 || this.counters[lastIndex][0] < time) {
      this.counters.push([time, 1])
    } else {
      for (var i = lastIndex; i >= 0; i--) {
        if (this.counters[i][0] < time) {
          this.counters.splice(i + 1, 0, [time, 1])
          return this
        } else if (this.counters[i][0] === time) {
          this.counters[i][1]++
          return this
        }
      }
      this.counters.unshift([time, 1])
    }
    return this
  }

  // compute speed for the last `size` minutes
  compute () {
    let speeds = Repeat(0, this.size)
    const lastIndex = this.counters.length - 1
    if (lastIndex === -1) {
      return speeds
    }
    speeds = speeds.toJS()
    const end = now()
    const start = end - this.size * 60
    for (var i = lastIndex; i >= 0; i--) {
      const time = this.counters[i][0]
      if (start <= time && time < end) {
        speeds[Math.floor((end - time) / 60)] += this.counters[i][1]
      }
    }
    return List(speeds)
  }
}

function withSpeed (session) {
  return session.update('speed', speed => speed.compute())
}

// The size of the session database
function size (sessions) {
  return sessions.reduce((total, sessions) => total + sessions.size, 0)
}

function gc (sessions) {
  const cutoff = now() - 3600
  console.log('Garbage collecting sessions older than', iso(cutoff))
  const oldCount = size(sessions)
  console.log(oldCount + ' sessions in the database.')
  sessions = sessions.map(sessions => sessions.filter(s => s.get('end') >= cutoff))
  console.log('Deleted', oldCount - size(sessions), 'sessions.')
  return sessions
}

class Database {
  constructor () {
    this.sessions = Map()
    this.gc = setInterval(function () {
      this.sessions = gc(this.sessions)
    }.bind(this), 3600 * 1000)
  }

  // assign a session to an event
  assign ({type, id, time, gap}) {
    let session = this.sessions.getIn([type, id])
    if (!session || (time - session.get('end')) > gap) {
      session = Map({
        type: type,
        id: id,
        updated: time,
        start: time,
        end: time + gap,
        count: 1,
        speed: new Speed(15).hit(time)
      })
    } else {
      session = session
        .set('updated', time)
        .update('start', start => Math.min(start, time))
        .update('end', end => Math.max(end, time))
        .update('count', n => n + 1)
        .update('speed', speed => speed.hit(time))
    }
    this.sessions = this.sessions.setIn([type, id], session)
    return session
  }

  // save session data
  save (session) {
    this.sessions = this.sessions.setIn([session.get('type'), session.get('id')], session)
  }

  // session of the given type and with the given id
  get (type, id) {
    return withSpeed(this.sessions.getIn([type, id]))
  }

  // list all sessions of a given type
  list ({type, sort}) {
    const sessions = this.sessions.get(type, Map()).map(withSpeed)
    if (sort === 'count') {
      return sessions.sort((a, b) => b.get('count') - a.get('count'))
    } else if (sort === 'speed') {
      return sessions.sort((a, b) => b.getIn(['speed', 0]) - a.getIn(['speed', 0]))
    }
    return sessions
  }

  close () {
    clearInterval(this.gc)
  }
}

module.exports = new Database()
