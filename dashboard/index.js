const config = require('../config/constants');

/* Dashboard and Assets */

const path = require('path');
const express = require('express');
const expressWs = require('express-ws');

const app = express();

expressWs(app);

app.set('view engine', 'ejs');

app.get('/', (req, res) => res.redirect('/dashboard'));

app.use(
  '/dashboard',
  express.static(path.dirname(require.resolve('access-watch-ui')))
);

app.get('/dashboard', (req, res) => {
  const host = req.headers.host;
  const baseUrl = req.baseUrl;
  const apiBaseUrl = `http://${host}${baseUrl}`;
  const websocket = `ws://${host}${baseUrl}`;
  const index = path.join(__dirname, 'views', 'index.ejs');
  res.render(index, {
    apiBaseUrl,
    websocket,
    uiConfig: JSON.stringify(
      Object.assign(
        {
          metrics: {
            expiration: config.metrics.gc.expiration,
          },
        },
        config.ui
      )
    ),
  });
});

/* Websocket */

const uuid = require('uuid/v4');

const { stream } = require('./pipeline');

function websocket(endpoint, stream) {
  let clients = {};

  app.ws(endpoint, (client, req) => {
    const clientId = uuid();
    clients[clientId] = client;
    client.on('close', () => {
      delete clients[clientId];
    });
  });

  stream.map(log => {
    Object.values(clients).forEach(client => {
      if (client.readyState === 1 /* === WebSocket.OPEN */) {
        client.send(JSON.stringify(log));
      }
    });
  });
}

websocket('/logs', stream);

module.exports = app;
