require('date-format-lite')

const path = require('path')
const express = require('express')
const uuid = require('uuid/v4')
const { Map } = require('immutable')

const app = require('../lib/app')
const metrics = require('../lib/metrics')
const session = require('../lib/session')
const { iso } = require('../lib/util')
const { stream } = require('./pipeline')

const db = metrics.getDatabase('traffic')

/* Dashboard and Assets */

app.get('/', (req, res) => res.redirect('/dashboard'))

app.use('/dashboard', express.static(path.join(__dirname, 'static')))

app.get('/dashboard', (req, res) => {
  const host = req.hostname
  const port = app.get('port')
  const apiBaseUrl = `http://${host}:${port}`
  const websocket = `ws://${host}:${port}`
  const index = path.join(__dirname, 'views', 'index.ejs')
  res.render(index, {apiBaseUrl, websocket})
})

/* API endpoints */

app.get('/activity', (req, res) => {
  res.send({'activity': getActivity(req.query)})
})

app.get('/metrics', (req, res) => {
  let metrics = getMetrics(req.query)
  const speed = getSpeed()
  if (speed) {
    metrics = metrics.setIn(['requests', 'speed'], speed)
  }
  res.send({'metrics': metrics})
})

app.get('/countries', (req, res) => {
  res.send({'countries': getCountries(req.query)})
})

app.get('/robots', (req, res) => {
  const limit = req.query.limit ? req.query.limit : 100
  const reputation = req.query.reputation ? req.query.reputation.split(',') : []
  res.send({sessions: getSessions({limit, reputation})})
})

app.get('/session/:sessionId', (req, res) => {
  let sess = getSession(req.params.sessionId)
  if (sess) {
    res.send(sess)
  } else {
    res.status(404).send('Unknown session.')
  }
})

app.get('/logs', (req, res) => {
  res.send({ logs: [] })
})

/* Websocket */

function websocket (endpoint, stream) {
  let clients = Map()

  app.ws(endpoint, function (ws, req) {
    const clientId = uuid()
    clients = clients.set(clientId, ws)
    ws.on('close', () => { clients = clients.delete(clientId) })
  })

  stream.map(log => {
    clients.forEach(client => {
      if (client.readyState === 1 /* === WebSocket.OPEN */) {
        client.send(JSON.stringify(log))
      }
    })
  })
}

websocket('/logs', stream)

/* API Helpers */

const sum = (a, b) => a + b
const percentage = (part, whole) => Math.round(100 * 100 * part / whole) / 100
const countAndPercentage = (part, whole) => Map({count: part, percentage: percentage(part, whole)})
const countAndSpeed = (metrics) => Map({count: metrics.reduce(sum, 0)})

function readParameters (query, parameters) {
  if (!parameters) {
    return query
  }
  if (parameters.after) {
    const after = new Date(parameters.after)
    if (after) {
      query = query.set('start', after.getTime() / 1000)
    }
  }
  if (parameters.before) {
    const before = new Date(parameters.before)
    if (before) {
      query = query.set('end', before.getTime() / 1000)
    }
  }
  if (parameters.step) {
    query = query.set('step', parseInt(parameters.step))
  }
  return query
}

function sumTaggedMetrics (metrics) {
  let total = 0
  return metrics
    .reduce((res, m) => {
      return m.reduce((res, val, tag) => {
        total += val
        return res.update(tag, 0, c => c + val)
      }, res)
    }, Map())
    .map(c => countAndPercentage(c, total))
}

function getSpeed () {
  const now = Date.now() / 1000
  const query = Map({before: now, after: now - 300}).set('name', 'request')
  const result = db.query(query)
  if (result.size > 1) {
    const count = result.reduce(sum, 0)
    const keys = result.keySeq().toArray()
    const period = Math.max(...keys) - Math.min(...keys)
    return Map({
      per_second: count / period,
      per_minute: 60 * count / period
    })
  }
}

function getActivity (parameters) {
  let query = Map({name: 'request'})
  query = readParameters(query, parameters)
  const byStatus = db.query(query.set('by', 'status'))
  const byType = db.query(query.set('by', 'type'))
  return byStatus.mergeWith((a, b) => a.merge(b), byType).mapKeys(k => iso(parseInt(k)))
}

function getCountries (parameters) {
  let query = Map({
    name: 'request',
    by: 'country',
    step: 3600
  })
  query = readParameters(query, parameters)
  if (parameters.type) {
    query = query.setIn(['tags', 'type'], parameters.type)
  }
  if (parameters.status) {
    query = query.setIn(['tags', 'status'], parameters.status)
  }
  return sumTaggedMetrics(db.query(query))
    .map((v, k) => v.set('country_code', k))
    .valueSeq()
}

function getMetrics (parameters) {
  let query = Map({
    name: 'request',
    step: 3600
  })
  query = readParameters(query, parameters)
  // If start is provided, we should insure that the step is smaller than the time asked for
  if (query.has('start')) {
    const start = query.get('start')
    const end = query.get('end') || new Date().getTime() / 1000
    query = query.set('step', Math.floor(end - start))
  }
  return Map({
    requests: countAndSpeed(db.query(query)),
    status: sumTaggedMetrics(db.query(query.set('by', 'status'))),
    type: sumTaggedMetrics(db.query(query.set('by', 'type')))
  })
}

function getSessions ({limit, reputation}) {
  return session
    .list()
    .valueSeq()
    .filter(s => (reputation.length === 0 || reputation.includes(s.getIn(['reputation', 'status']))))
    .map(s => s.update('updated', Date.now() / 1000, iso).toJS())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

function getSession (sessionId) {
  const sess = session.get(sessionId)
  if (sess) {
    return sess
      .update('updated', Date.now() / 1000, iso)
      .toJS()
  }
}
