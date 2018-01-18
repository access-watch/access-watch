const express = require('express');
const expressWs = require('express-ws');
const uuid = require('uuid/v4');

const app = express();
expressWs(app);

function websocket(endpoint, stream) {
  const clients = {};

  app.ws(endpoint, client => {
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

const { stream } = require('../pipeline/websocket');

websocket('logs', stream);

module.exports = app;
