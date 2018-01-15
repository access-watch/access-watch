const elasticsearch = require('elasticsearch');
const { isImmutable } = require('immutable');
const accessLogsIndexConfig = require('./access-logs_index.json');

const accessLogsIndex = 'access-watch-access-logs';

const indexAccessLog = client => log => {
  const logJS = isImmutable(log) ? log.toJS() : log;
  delete logJS.uuid;
  return client.index({
    index: accessLogsIndex,
    type: 'access-log',
    routing: logJS.address.value,
    body: logJS,
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
      index: accessLogsIndex,
      type: 'access-log',
      body,
      size,
    })
    .then(({ hits }) => {
      if (hits) {
        return hits.hits.map(({ _source }) => _source);
      }
      return [];
    })
    .catch(e => console.log(e));
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
  esClient.indices.delete({ index: accessLogsIndex }).then(_ => {
    esClient.indices.exists({ index: accessLogsIndex }).then(exists => {
      if (!exists) {
        esClient.indices.create({
          index: accessLogsIndex,
          body: accessLogsIndexConfig,
        });
      }
    });
  });
  return {
    index: indexAccessLog(esClient),
    searchLogs: searchLogs(esClient),
    logsEndpoint: logsEndpoint(esClient),
  };
};

module.exports = elasticSearchBuilder;
