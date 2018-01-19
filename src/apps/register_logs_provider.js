const { stream } = require('../pipeline/augmented');
const app = require('../apps/api');

module.exports = logsProvider => {
  stream.map(logsProvider.index);

  app.get('/logs', (req, res) => {
    const { query } = req;
    logsProvider.searchLogs(query).then(logs => res.send(logs));
  });
};
