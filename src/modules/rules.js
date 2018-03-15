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
  rules.toNginx('blocked').then(rules => res.send(rules));
});

app.get('/rules/export/apache', (req, res) => {
  res.header('Content-Type', 'text/plain');
  rules.toApache('blocked').then(rules => res.send(rules));
});

app.get('/rules/export/txt', (req, res) => {
  res.header('Content-Type', 'text/plain');
  rules.toTxt('blocked').then(rules => res.send(rules));
});

app.post('/rules', (req, res) => {
  res.send(rules.add(fromJS(req.body)));
});

app.delete('/rules/:id', (req, res) => {
  rules.remove(req.params.id);
  res.send('ok');
});
