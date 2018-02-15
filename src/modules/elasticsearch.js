const config = require('../constants');
const elasticSearchBuilder = require('../plugins/elasticsearch');
const { stream } = require('../pipeline/augmented');
const app = require('../apps/api');
const { parseFilterQuery } = require('../lib/filter');
const elasticsearch = elasticSearchBuilder(config.elasticsearch.configuration);

// As we are using elasticsearch, we don't need to use the memory to hold logs
config.logs.memory.retention = 0;
config.session.timerange = true;

stream.map(elasticsearch.index);

app.get('/logs', (req, res) => {
  const { query } = req;
  elasticsearch
    .searchLogs(parseFilterQuery(query))
    .then(logs => res.send(logs));
});

const transformSession = sessionName => session => ({
  count: session.count,
  reputation: session.reputation,
  id: session.id,
  [sessionName]: session,
});

const searchFns = {
  robot: elasticsearch.searchRobots,
  address: elasticsearch.searchAddresses,
};

app.get('/sessions/:type', (req, res) => {
  const { params, query } = req;
  const { start, end } = query;
  const { type } = params;
  if (start && end) {
    if (searchFns[type]) {
      searchFns[type](parseFilterQuery(query)).then(sessions =>
        res.send(sessions.map(transformSession(type)))
      );
    }
  }
});

app.get('/sessions/:type', (req, res) => {
  const { params, query } = req;
  const { start, end, filter } = query;
  const { type } = params;
  if (start && end && type === 'robot') {
    const esQuery = { start, end };
    if (filter) {
      const [key, value] = filter.split(':');
      esQuery[key] = value;
    }
    elasticsearch.searchRobots(esQuery).then(robots =>
      res.send(
        robots.map(robot => ({
          count: robot.count,
          reputation: robot.reputation,
          id: robot.id,
          robot,
        }))
      )
    );
  }
});
