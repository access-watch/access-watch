// create the databases
const session = require('./lib/session').createDatabase('traffic')
const metrics = require('./lib/metrics').createDatabase('traffic')
const rules = require('./lib/rules').createDatabase('traffic', {path: 'rules.json'})

// import the framework
const app = require('./lib/app')
const pipeline = require('./lib/pipeline')

// configure the application
require('./config')

// start the application
function start () {
  pipeline.start()
  app.start()
}

start()

// stop the application
function stop () {
  pipeline.close()
  rules.close()
  metrics.close()
  session.close()
  process.exit()
}

process.on('SIGINT', stop)
