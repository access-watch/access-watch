const express = require('express');
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json());

/* Core API endpoints */

app.get('/monitoring', (req, res) => {
  res.send(pipeline.monitoring());
});

app.get('/stats', (req, res) => {
  res.send({
    stats: {
      metrics: metrics.stats(),
      sessions: session.stats(),
    },
  });
});

app.use((err, req, res, next) => {
  const httpStatus = err.httpStatus || 500;
  res.status(httpStatus).send({ error: err.message });
});

module.exports = app;
