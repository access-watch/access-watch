const { fromJS } = require('immutable');

const { stream } = require('../pipeline/augmented');

const rules = require('../lib/rules').connect();

stream.map(log => rules.match(log));

// API endpoints

const app = require('../lib/api');

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
