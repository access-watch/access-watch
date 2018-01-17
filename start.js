// import the framework
const app = require('./src/lib/app');
const api = require('./src/lib/api');
const websocket = require('./src/lib/websocket');
const pipeline = require('./src/lib/pipeline');
const database = require('./src/lib/database');
const dashboard = require('./src/dashboard');

// load the configuration
require('./config');

// Modules
require('./src/modules/metrics');
require('./src/modules/session');
require('./src/modules/rules');

// mount API, Dashboard and Websocket
app.use(api);
app.use(dashboard);
app.use(websocket);

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
