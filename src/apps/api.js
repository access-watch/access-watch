const express = require('express');

const monitoring = require('../lib/monitoring');

const app = express();

app.use(express.json());

app.get('/monitoring', (req, res) => {
  res.send(monitoring.getAllComputed());
});

module.exports = app;
