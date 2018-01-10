const express = require('express')
const expressWs = require('express-ws')
const bodyParser = require('body-parser')
const { fromJS, Map } = require('immutable')

const metrics = require('./metrics').connect('aw:file://metrics')
const session = require('./session').connect('aw:file://sessions')
const rules = require('./rules').connect('aw:file://rules')

const pipeline = require('./pipeline')
const { now, iso } = require('./util')
const config = require('../config/constants')

const app = express()

expressWs(app)

app.use(bodyParser.json())

app.set('view engine', 'ejs')

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET')
  res.header('Access-Control-Allow-Headers', 'Authorization')
  next()
})

app.set('port', process.env.PORT || config.port)

app.start = () => {
  app.listen(app.get('port'), () => {
    console.log('HTTP and Websocket Server listening on port %d', app.get('port'))
  })
}

/* Core API endpoints */

class UserError extends Error {
  constructor (...args) {
    super(...args)
    this.httpStatus = 400
  }
}

class NotFound extends Error {
  constructor (...args) {
    super(...args)
    this.httpStatus = 404
  }
}

function parseTimestamp (query, name) {
  const ts = parseInt(query[name])
  if (isNaN(ts) || ts < 0) {
    throw new UserError('The parameter "' + name + '" should be a timestamp in seconds.')
  }
  return ts
}

function parsePosInt (query, name) {
  const n = parseInt(query[name])
  if (isNaN(n) || n < 0) {
    throw new UserError('The parameter "' + name + '" should be a positive integer.')
  }
  return n
}

function parseFilter (query, name) {
  const filter = query[name]
  const [path, values] = filter.split(':')
  const keyPath = path.split('.')
  const keyValues = values.split(',')
  return item => keyValues.indexOf(item.getIn(keyPath)) !== -1
}

const reservedParameters = ['dateFormat', 'start', 'end', 'step', 'by']

function parseRequest (req) {
  let query = Map({name: req.params.name})
  if (!req.query) {
    return query
  }
  if (req.query.start) {
    query = query.set('start', parseTimestamp(req.query, 'start'))
  }
  if (req.query.end) {
    query = query.set('end', parseTimestamp(req.query, 'end'))
  } else {
    query = query.set('end', now())
  }
  if (req.query.step) {
    query = query.set('step', parsePosInt(req.query, 'step'))
  }
  if (req.query.by) {
    query = query.set('by', req.query.by)
  }
  const tags = Map(req.query).removeAll(reservedParameters)
  if (!tags.isEmpty()) {
    query = query.set('tags', tags)
  }
  return query
}

app.get('/metrics/:name', (req, res) => {
  const query = parseRequest(req)
  let data = metrics.query(query)
  if (req.query && req.query.dateFormat === 'iso8601') {
    data = data.map(([t, v]) => [iso(t), v])
  }
  res.send(data)
})

app.get('/sessions/:type', (req, res) => {
  res.send(session.list({
    type: req.params.type,
    sort: req.query.sort || 'count',
    filter: (req.query.filter && parseFilter(req.query, 'filter')) || null,
    limit: (req.query.limit && parseInt(req.query.limit)) || 100
  }))
})

app.get('/sessions/:type/:id', (req, res) => {
  const s = session.get(req.params.type, req.params.id)
  if (s) {
    res.send(s)
  } else {
    throw new NotFound('Unknown session.')
  }
})

app.get('/rules', (req, res) => {
  res.send(rules.list())
})

app.get('/rules/export/nginx', (req, res) => {
  res.header('Content-Type', 'text/plain')
  res.send(rules.toNginx())
})

app.post('/rules', (req, res) => {
  rules.add(fromJS(req.body))
  res.send('ok')
})

app.delete('/rules/:id', (req, res) => {
  rules.remove(req.params.id)
  res.send('ok')
})

app.get('/monitoring', (req, res) => {
  res.send(pipeline.monitoring())
})

app.get('/stats', (req, res) => {
  res.send({
    stats: {
      metrics: metrics.stats(),
      sessions: session.stats()
    }
  })
})

app.use((err, req, res, next) => {
  const httpStatus = err.httpStatus || 500
  res.status(httpStatus).send({error: err.message})
})

module.exports = app
