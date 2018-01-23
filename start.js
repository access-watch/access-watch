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
expressWs(app);

app.use(
  accessWatch.apps.api,
  accessWatch.apps.dashboard,
  accessWatch.apps.websocket
);

app.set('port', process.env.PORT || accessWatch.constants.port);

app.listen(app.get('port'), () => {
  console.log(
    'HTTP and Websocket Server listening on port %d',
    app.get('port')
  );
});

// Start Pipeline

accessWatch.pipeline.start();

// Handle Shutdown

process.on('SIGINT', () => {
  accessWatch.database.close();
  // eslint-disable-next-line no-process-exit
  process.exit();
});
