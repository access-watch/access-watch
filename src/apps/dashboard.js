const path = require('path');
const express = require('express');

const config = require('../constants');

const app = express();

app.set('view engine', 'ejs');

app.get('/', (req, res) => res.redirect(`${req.baseUrl}/dashboard`));

app.use(
  '/dashboard',
  express.static(path.dirname(require.resolve('access-watch-ui')))
);

app.get('/dashboard', (req, res) => {
  const host = req.get('host');
  const baseUrl = req.baseUrl;
  const scheme = req.protocol;
  const apiBaseUrl = `${scheme}://${host}${baseUrl}`;
  const websocketScheme = scheme === 'https' ? 'wss' : 'ws';
  const websocket = `${websocketScheme}://${host}${baseUrl}`;
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
          session: {
            expiration: config.session.gc.expiration,
            timerange: config.session.timerange,
          },
        },
        config.ui
      )
    ),
  });
});

module.exports = app;
