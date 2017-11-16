const process = require('process')

const session = require('./lib/session')
const metrics = require('./lib/metrics')
const db = metrics.createDatabase('traffic')

const app = require('./lib/app')
const pipeline = require('./lib/pipeline')

require('./config')
require('./dashboard')

function start () {
  pipeline.start()
  app.start()
}

function stop () {
  pipeline.close()
  db.close()
  session.close()
  process.exit()
}

start()

process.on('SIGINT', stop)
