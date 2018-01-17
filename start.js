const path = require('path');

// import the framework

const accessWatch = require('.');
const { app, apps, pipeline, database } = accessWatch();

// load the configuration
if (process.argv[2]) {
  require(path.resolve(process.cwd(), process.argv[2]));
} else {
  require(path.resolve(__dirname, './default'));
}

// Modules
require('./src/modules/metrics');
require('./src/modules/session');
require('./src/modules/rules');

// mount Apps (API, Dashboard and Websocket) on main App
const { api, websocket, dashboard } = apps;
app.use(api);
app.use(websocket);
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
