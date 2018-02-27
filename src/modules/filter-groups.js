const { filterGroups } = require('../databases');

// API endpoints

const app = require('../apps/api');

app.get('/filter_groups', (req, res) => {
  res.send(filterGroups.list());
});

app.post('/filter_groups/:type', (req, res) => {
  const { type } = req.params;
  filterGroups.add({ filterGroup: req.body, type });
  res.send('ok');
});

app.post('/filter_groups/:type/reorder', (req, res) => {
  const { type } = req.params;
  const { oldIndex, newIndex } = req.body;
  filterGroups.reorder({ oldIndex, newIndex, type });
  res.send('ok');
});

app.post('/filter_groups/:type/:id', (req, res) => {
  const { type, id } = req.params;
  filterGroups.update({
    filterGroup: Object.assign({}, req.body, { id }),
    type,
  });
  res.send('ok');
});

app.delete('/filter_groups/:type/:id', (req, res) => {
  const { id, type } = req.params;
  filterGroups.remove({ id, type });
  res.send('ok');
});
