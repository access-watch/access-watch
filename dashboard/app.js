require('date-format-lite')

const path = require('path')
const express = require('express')
const uuid = require('uuid/v4')
const { Map } = require('immutable')

const app = require('../lib/app')
const metrics = require('../lib/metrics')
const session = require('../lib/session')
const { iso, now } = require('../lib/util')
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
