const express = require('express');
const bodyParser = require('body-parser');

const pipeline = require('../lib/pipeline');

const app = express();

app.use(bodyParser.json());

/* Core API endpoints */

app.get('/monitoring', (req, res) => {
  res.send(pipeline.monitoring());
});

app.use((err, req, res) => {
  const httpStatus = err.httpStatus || 500;
  res.status(httpStatus).send({ error: err.message });
});

module.exports = app;
