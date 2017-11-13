const process = require('process')

const metrics = require('./lib/metrics')
const db = metrics.createDatabase('traffic')

const app = require('./lib/app')
const pipeline = require('./lib/pipeline')

require('./config')

pipeline.start()
app.start()

process.on('SIGTERM', function () {
  pipeline.close()
  app.close()
  db.close()
})
