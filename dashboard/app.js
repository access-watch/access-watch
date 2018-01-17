const path = require('path');
const express = require('express');
const uuid = require('uuid/v4');
const { Map } = require('immutable');

const app = require('../lib/app');
const { stream } = require('./pipeline');
const config = require('../config/constants');

/* Dashboard and Assets */

app.get('/', (_, res) => res.redirect('/dashboard'));

app.use(
  '/dashboard',
  express.static(path.join(__dirname, '../node_modules/access-watch-ui/dist'))
);

app.get('/dashboard', (req, res) => {
  const host = req.hostname;
  const port = app.get('port');
  const apiBaseUrl = `http://${host}:${port}`;
  const websocket = `ws://${host}:${port}`;
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

function websocket(endpoint, stream) {
  let clients = Map();

  app.ws(endpoint, ws => {
    const clientId = uuid();
    clients = clients.set(clientId, ws);
    ws.on('close', () => {
      clients = clients.delete(clientId);
    });
  });

  stream.map(log => {
    clients.forEach(client => {
      if (client.readyState === 1 /* === WebSocket.OPEN */) {
        client.send(JSON.stringify(log));
      }
    });
  });
}

websocket('/logs', stream);
