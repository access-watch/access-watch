const config = require('../constants');
const elasticSearchBuilder = require('../plugins/elasticsearch');
const { stream } = require('../pipeline/augmented');
const app = require('../apps/api');
const { parseFilterQuery } = require('../lib/filter');
const elasticsearch = elasticSearchBuilder(config.elasticsearch.configuration);

// As we are using elasticsearch, we don't need to use the memory to hold logs
config.logs.memory.retention = 0;
config.session.timerange = true;
config.modules.session.active = false;

stream.map(elasticsearch.index);

app.get('/logs', (req, res) => {
  const { query } = req;
  elasticsearch
    .searchLogs(parseFilterQuery(query))
    .then(logs => res.send(logs));
});

const transformSession = sessionName => ({ es, hub }) =>
  Object.assign(es, {
    end: Math.floor(new Date(es.end).getTime() / 1000),
    updated: Math.floor(new Date(es.end).getTime() / 1000),
    reputation: hub.reputation,
    type: sessionName,
    [sessionName]: hub,
  });

const searchFns = {
  robot: elasticsearch.searchRobots,
  address: elasticsearch.searchAddresses,
};

app.get('/sessions/:type', (req, res) => {
  const { params, query } = req;
  const { type } = params;
  if (searchFns[type]) {
    searchFns[type](parseFilterQuery(query)).then(sessions =>
      res.send(sessions.map(transformSession(type)))
    );
  }
});
