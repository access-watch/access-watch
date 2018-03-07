const { fromJS } = require('immutable');

const { rules } = require('../databases');

// Pipeline

const { stream } = require('../pipeline/augmented');

stream.map(log => rules.match(log));

// API endpoints

const app = require('../apps/api');

app.get('/rules', (req, res) => {
  res.send(rules.list('blocked'));
});

app.get('/rules/export/nginx', (req, res) => {
  res.header('Content-Type', 'text/plain');
  res.send(rules.toNginx('blocked'));
});

app.get('/rules/export/apache', (req, res) => {
  res.header('Content-Type', 'text/plain');
  res.send(rules.toApache('blocked'));
});

app.get('/rules/export/txt', (req, res) => {
  res.header('Content-Type', 'text/plain');
  res.send(rules.toTxt('blocked'));
});

app.post('/rules', (req, res) => {
  res.send(rules.add(fromJS(req.body)));
});

app.delete('/rules/:id', (req, res) => {
  rules.remove(req.params.id);
  res.send('ok');
});
