// import the framework
const app = require('./src/lib/app');
const api = require('./src/lib/api');
const pipeline = require('./src/lib/pipeline');
const database = require('./src/lib/database');
const dashboard = require('./src/dashboard');

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
