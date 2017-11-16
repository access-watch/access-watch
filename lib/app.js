const express = require('express')
const expressWs = require('express-ws')
const bodyParser = require('body-parser')
const { Map } = require('immutable')

const metrics = require('./metrics')
const session = require('./session')
const pipeline = require('./pipeline')

const db = metrics.getDatabase('traffic')
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

app.set('port', process.env.PORT || 3000)

app.start = () => {
  app.listen(app.get('port'), function () {
    console.log('HTTP and Websocket Server listening on port %d', app.get('port'))
  })
}

/* Core API endpoints */

function buildQuery (req) {
  let query = Map({name: req.params.name})
  if (!req.query) {
    return query
  }
  if (req.query.start) {
    const start = new Date(req.query.start)
    query = query.set('start', start.getTime() / 1000)
  }
  if (req.query.end) {
    const end = new Date(req.query.end)
    query = query.set('end', end.getTime() / 1000)
  }
  if (req.query.step) {
    query = query.set('step', parseInt(req.query.step))
  }
  if (req.query.by) {
    query = query.set('by', req.query.by)
  }
  const tags = Map(req.query).removeAll(['start', 'end', 'step', 'by'])
  if (!tags.isEmpty()) {
    query = query.set('tags', tags)
  }
  return query
}

app.get('/metrics/:name', (req, res) => {
  res.send(db.query(buildQuery(req)))
})

app.get('/sessions/', (req, res) => {
  res.send(session.list())
})

app.get('/monitoring', (req, res) => {
  res.send(pipeline.monitoring())
})

module.exports = app
