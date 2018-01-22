const config = require('../constants');
const elasticSearchBuilder = require('../plugins/elasticsearch');
const { stream } = require('../pipeline/augmented');
const app = require('../apps/api');
const elasticsearch = elasticSearchBuilder(config.elasticsearch.configuration);

// As we are using elasticsearch, we don't need to use the memory to hold logs
config.logs.memory.retention = 0;

stream.map(elasticsearch.index);

app.get('/logs', (req, res) => {
  const { query } = req;
  elasticsearch.searchLogs(query).then(logs => res.send(logs));
});
