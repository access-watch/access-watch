const http = require('http');
const path = require('path');
const express = require('express');
const expressWs = require('express-ws');

// Load configuration

if (process.argv[2]) {
  require(path.resolve(process.cwd(), process.argv[2]));
} else {
  require(path.resolve(__dirname, './config/default'));
}

// Load Core

const accessWatch = require('./access-watch')();

// Load Express

const app = express();
const httpServer = http.createServer(app);
expressWs(app, httpServer);

app.use(
  accessWatch.apps.api,
  accessWatch.apps.dashboard,
  accessWatch.apps.websocket
);

Object.keys(accessWatch.constants.app).forEach(key => {
  app.set(key, accessWatch.constants.app[key]);
});

const port = process.env.PORT || accessWatch.constants.port;

httpServer.listen(port, () => {
  console.log(`HTTP and Websocket Server listening on port ${port}`);
});

// Start Pipeline

accessWatch.pipeline.start();

// Handle Shutdown

let shutdownInProgress;

function shutdown() {
  if (!shutdownInProgress) {
    shutdownInProgress = true;
    Promise.all([
      httpServer.close(),
      accessWatch.pipeline.stop(),
      accessWatch.database.close(),
    ])
      .then(() => {
        process.exit();
      })
      .catch(console.error);
  }
}

process.on('SIGTERM', () => {
  console.log('SIGTERM');
  shutdown();
});

process.on('SIGINT', () => {
  console.log('SIGINT');
  shutdown();
});

// Instrumentation

setInterval(() => {
  const memoryUsage = process.memoryUsage();
  Object.keys(memoryUsage).forEach(key => {
    accessWatch.instruments.gauge(`process.memory.${key}`, memoryUsage[key]);
  });
}, 1000);
