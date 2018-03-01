const { searches } = require('../databases');

// API endpoints

const app = require('../apps/api');

app.get('/searches', (req, res) => {
  res.send(searches.list());
});

app.post('/searches/:type', (req, res) => {
  const { type } = req.params;
  searches.add({ search: req.body, type });
  res.send('ok');
});

app.post('/searches/:type/reorder', (req, res) => {
  const { type } = req.params;
  const { oldIndex, newIndex } = req.body;
  searches.reorder({ oldIndex, newIndex, type });
  res.send('ok');
});

app.post('/searches/:type/:id', (req, res) => {
  const { type, id } = req.params;
  searches.update({
    search: Object.assign({}, req.body, { id }),
    type,
  });
  res.send('ok');
});

app.delete('/searches/:type/:id', (req, res) => {
  const { id, type } = req.params;
  searches.remove({ id, type });
  res.send('ok');
});
