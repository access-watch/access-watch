const { fromJS } = require('immutable');

const { rules } = require('../databases');

// Pipeline

const { stream } = require('../pipeline/augmented');

stream.map(log => rules.match(log));

// API endpoints

const app = require('../apps/api');

app.get('/rules', (req, res) => {
  res.send(rules.list());
});

app.get('/rules/export/nginx', (req, res) => {
  res.header('Content-Type', 'text/plain');
  res.send(rules.toNginx());
});

app.get('/rules/export/apache', (req, res) => {
  res.header('Content-Type', 'text/plain');
  res.send(rules.toApache());
});

app.post('/rules', (req, res) => {
  rules.add(fromJS(req.body));
  res.send('ok');
});

app.delete('/rules/:id', (req, res) => {
  rules.remove(req.params.id);
  res.send('ok');
});
