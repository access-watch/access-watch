const omit = require('lodash.omit');
const elasticsearch = require('elasticsearch');
const accessWatchLogsIndexConfig = require('./access-watch-logs-index-config.json');
const config = require('../../constants');

const accessLogsIndex = config.elasticsearch.logsIndexName;

const getIndexSuffix = date =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()].join('-');

const generateIndex = date => `${accessLogsIndex}-${getIndexSuffix(date)}`;

const generateCurrentIndex = () => generateIndex(new Date());
const getIndexDate = index =>
  index.slice(accessLogsIndex.length + 1).replace(/-/g, '/');

const indexAccessLog = client => log =>
  client.index({
    index: generateCurrentIndex(),
    type: 'access-log',
    routing: log.getIn(['address', 'value']),
    body: log.toJS(),
  });

const indexesGc = client => () => {
  client.indices.get({ index: '*' }).then(indices => {
    Object.keys(indices)
      .filter(i => i.indexOf(accessLogsIndex) !== -1)
      .forEach(index => {
        const indexDate = new Date(getIndexDate(index));
        const gcDate = new Date(
          new Date().getTime() -
            config.elasticsearch.retention * 24 * 3600 * 1000
        );
        if (indexDate.getTime() < gcDate.getTime()) {
          client.indices.delete({ index });
        }
      });
  });
};

const reservedSearchTerms = ['start', 'end', 'limit'];

const searchLogs = client => (query = {}) => {
  const { start, end, limit: size } = query;
  const queryMatch = omit(query, reservedSearchTerms);
  let bool = {};
  const body = {
    sort: [
      {
        'request.time': {
          order: 'desc',
        },
      },
    ],
  };
  if (Object.keys(queryMatch).length) {
    bool.must = Object.keys(queryMatch).map(k => {
      const value = queryMatch[k];
      const values = value.split(',');
      if (values.length === 1) {
        return {
          match: { [k]: value },
        };
      }
      return {
        bool: {
          should: values.map(val => ({ match: { [k]: val } })),
        },
      };
    });
  }
  if (start || end) {
    bool.filter = {
      range: {
        'request.time': Object.assign(
          start ? { gte: start } : {},
          end ? { lte: end } : {}
        ),
      },
    };
  }
  if (Object.keys(bool).length > 0) {
    body.query = { bool };
  }
  return client
    .search({
      index: `${accessLogsIndex}-*`,
      type: 'access-log',
      body,
      size,
    })
    .then(({ hits }) => {
      if (hits) {
        return hits.hits.map(({ _source }) => _source);
      }
      return [];
    });
};

const logsEndpoint = client => {
  const search = searchLogs(client);
  return (req, res) => {
    const { query } = req;
    search(query).then(logs => res.send(logs));
  };
};

const elasticSearchBuilder = config => {
  const esClient = new elasticsearch.Client(config);
  const index = generateCurrentIndex();
  const gc = indexesGc(esClient);
  setImmediate(gc);
  setInterval(gc, 24 * 3600 * 1000);
  esClient.indices.exists({ index }).then(exists => {
    if (!exists) {
      esClient.indices.create({
        index,
        body: accessWatchLogsIndexConfig,
      });
    }
  });
  return {
    index: indexAccessLog(esClient),
    searchLogs: searchLogs(esClient),
    logsEndpoint: logsEndpoint(esClient),
  };
};

module.exports = elasticSearchBuilder;
