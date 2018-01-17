const elasticsearch = require('elasticsearch');
const accessLogsIndexConfig = require('./access-logs_index.json');
const config = require('../../config/constants');

const accessLogsIndex = 'access-watch-access-logs';

const getIndexSuffix = date =>
  [date.getMonth() + 1, date.getDate(), date.getFullYear()].join('-');

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

const logsSearchArguments = {
  address: value => ({ address: { value } }),
  identity_type: type => ({ identity: { type } }),
  request_method: method => ({ request: { method } }),
  reputation_status: status => ({ reputation: { status } }),
  response_status: status => ({ response: { status } }),
  robot: id => ({ robot: { id } }),
};

const flattenKeys = obj =>
  Object.keys(obj).reduce((flat, k) => {
    if (typeof obj[k] !== 'object' || Array.isArray(obj[k])) {
      return obj;
    }
    const recObj = flattenKeys(obj[k]);
    const childKey = Object.keys(recObj)[0];
    return Object.assign({ [`${k}.${childKey}`]: recObj[childKey] }, flat);
  }, {});

const logsSearchBodyBuilder = searchObj =>
  Object.keys(logsSearchArguments).reduce((acc, k) => {
    if (searchObj[k]) {
      return Object.assign(
        flattenKeys(logsSearchArguments[k](searchObj[k])),
        acc
      );
    }
    return acc;
  }, {});

const reservedSearchTerms = ['start', 'end', 'limit'];

const searchLogs = client => (query = {}) => {
  const { start, end, limit: size } = query;
  const qObj = Object.keys(query)
    .filter(k => reservedSearchTerms.indexOf(k) === -1)
    .reduce((acc, k) => Object.assign({ [k]: query[k] }, acc), {});
  const queryMatch = logsSearchBodyBuilder(qObj);
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
    bool.must = { match: queryMatch };
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
  gc();
  setInterval(gc, 24 * 3600 * 1000);
  esClient.indices.exists({ index }).then(exists => {
    if (!exists) {
      esClient.indices.create({
        index,
        body: accessLogsIndexConfig,
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
