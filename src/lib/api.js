const express = require('express');
const bodyParser = require('body-parser');

const pipeline = require('../lib/pipeline');

const app = express();

app.use(bodyParser.json());

app.get('/monitoring', (req, res) => {
  res.send(pipeline.monitoring());
});

module.exports = app;
