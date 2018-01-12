// import the framework
const app = require('./lib/app');
const api = require('./lib/api');
const pipeline = require('./lib/pipeline');
const database = require('./lib/database');
const dashboard = require('./dashboard');

// load the configuration
require('./config');

// load the API
app.use(api);

// load the Dashboard
app.use(dashboard);

// start the application
function start() {
  pipeline.start();
  app.start();
}

// stop the application
function stop() {
  database.close();
  // eslint-disable-next-line no-process-exit
  process.exit();
}

start();

process.on('SIGINT', stop);
