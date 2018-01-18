const path = require('path');
const express = require('express');
const expressWs = require('express-ws');

const accessWatch = require('.')();

// Load configuration

if (process.argv[2]) {
  require(path.resolve(process.cwd(), process.argv[2]));
} else {
  require(path.resolve(__dirname, './default'));
}

// Load Express

const app = express();
expressWs(app);

app.use(accessWatch.apps.api);
app.use(accessWatch.apps.websocket);
app.use(accessWatch.apps.dashboard);

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