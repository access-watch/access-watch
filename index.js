// import the framework
const app = require('./lib/app');
const pipeline = require('./lib/pipeline');
const database = require('./lib/database');

// configure the application
require('./config');

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
