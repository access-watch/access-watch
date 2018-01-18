const express = require('express');

const pipeline = require('../lib/pipeline');

const app = express();

app.use(express.json());

app.get('/monitoring', (req, res) => {
  res.send(pipeline.monitoring());
});

module.exports = app;
