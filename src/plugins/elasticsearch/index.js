require('date-format-lite');
const omit = require('lodash.omit');
const { Map } = require('immutable');
const elasticsearch = require('elasticsearch');
const { filters } = require('access-watch-sdk');
const { getSession } = require('../hub');
const logsIndexConfig = require('./logs-index-config.json');
const config = require('../../constants');
const monitoring = require('../../lib/monitoring');
const { iso, now } = require('../../lib/util');
const { rules } = require('../../databases');
const { rulesMatchers } = require('../../lib/rules');

const monitor = monitoring.registerOutput({ name: 'Elasticsearch' });

const { logsIndexName, expiration } = config.elasticsearch;

const generateIndexName = date =>
  `${logsIndexName}-${date.format('YYYY-MM-DD', 0)}`;

const getIndexDate = index =>
  index.slice(logsIndexName.length + 1).replace(/-/g, '/');

const getGcDate = () =>
  new Date(new Date().getTime() - expiration * 24 * 3600 * 1000);

const indexesDb = {};

const reportOnError = promise =>
  promise.catch(e => {
    // Remove the eventual Error: that might come from the error from ES
    const errString = e.message.replace('Error :', '');
    monitor.status = `Error: ${errString}`;
    console.error(`Elasticsearch error: ${errString}`);
  });

const createIndexIfNotExists = client => index => {
  if (!indexesDb[index]) {
    indexesDb[index] = reportOnError(
      client.indices.exists({ index }).then(exists => {
        if (!exists) {
          return client.indices.create({
            index,
            body: logsIndexConfig,
          });
        }
      })
    );
  }
  return indexesDb[index];
};

const indexLog = client => log => {
  const logTime = new Date(log.getIn(['request', 'time']));
  const gcDate = getGcDate();
  if (logTime.getTime() > gcDate.getTime()) {
    const index = generateIndexName(logTime);
    createIndexIfNotExists(client)(index).then(() => {
      reportOnError(
        client
          .index({
            index,
            type: 'log',
            routing: log.getIn(['address', 'value']),
            body: log.toJS(),
          })
          .then(() => {
            monitor.status = 'Connected and indexing';
            monitor.hit();
          })
      );
    });
  } else {
    console.log(
      `Not indexing old log (${logTime}), current expiration: ${expiration}`
    );
  }
};

const indexesGc = client => () => {
  reportOnError(
    client.indices.get({ index: '*' }).then(indices => {
      Object.keys(indices)
        .filter(i => i.indexOf(logsIndexName) !== -1)
        .forEach(index => {
          const indexDate = new Date(getIndexDate(index));
          const gcDate = getGcDate();
          if (indexDate.getTime() < gcDate.getTime()) {
            reportOnError(client.indices.delete({ index }));
          }
        });
    })
  );
};

const caseInsentivizeRegexpValue = value => {
  const getChar = c => {
    const lower = c.toLowerCase();
    const upper = c.toUpperCase();
    return lower !== upper ? `[${lower}${upper}]` : c;
  };
  return ('' + value)
    .split('')
    .map(getChar)
    .join('');
};

const getESValue = ({ id, value }, type) => {
  const filter = filters[type].find(f => f.id === id);
  if (filter && filter.fullText) {
    // Performance-wise this is not the greatest, but it's the only working
    // way I found for wildcard + case-insensitive matching for ES
    return {
      regexp: {
        [id]: `.*${caseInsentivizeRegexpValue(value)}.*`,
      },
    };
  }
  return { match: { [id]: value } };
};

const getMustFromFilter = (filter, type) =>
  Object.keys(filter).map(id => {
    const { negative, values, exists } = filter[id];
    let cond;
    if (exists) {
      cond = { exists: { field: id } };
    } else {
      cond =
        values.length === 1
          ? getESValue({ id, value: values[0] }, type)
          : {
              bool: {
                should: values.map(value => getESValue({ id, value }, type)),
              },
            };
    }
    return negative ? { bool: { must_not: cond } } : cond;
  });

const search = client => (query = {}, type) => {
  const { start, end, limit: size, aggs, filter, must } = query;
  let bool = {
    filter: [
      {
        exists: {
          field: 'identity.id',
        },
      },
    ],
  };
  const body = {
    sort: [
      {
        'request.time': {
          order: 'desc',
        },
      },
    ],
  };
  if (filter) {
    bool.must = getMustFromFilter(filter, type);
  }
  if (must) {
    bool.must = (bool.must || []).concat(must);
  }
  if (start || end) {
    bool.filter.push({
      range: {
        'request.time': Object.assign(
          start ? { gte: iso(start) } : {},
          end ? { lte: iso(end) } : {}
        ),
      },
    });
  }
  if (aggs) {
    body.aggs = aggs;
  }
  body.query = { bool };
  return reportOnError(
    client.search({
      index: `${logsIndexName}-*`,
      type: 'log',
      body,
      size,
    })
  );
};

const searchLogs = client => (query = {}) =>
  search(client)(query, 'log').then(({ hits }) => {
    if (hits) {
      return hits.hits.map(({ _source }) => _source);
    }
    return [];
  });

const metricsMapping = {
  status: 'robot.reputation.status',
  type: 'identity.type',
  country: 'address.country_code',
};

const searchMetrics = client => (query = {}) => {
  const { step, by, filter: origFilter = {} } = query;
  const filter = Object.assign({}, origFilter);
  Object.keys(metricsMapping).forEach(key => {
    if (query[key]) {
      filter[metricsMapping[key]] = {
        id: metricsMapping[key],
        values: [query[key]],
      };
    }
  });
  return search(client)(
    Object.assign({}, query, {
      aggs: {
        metrics: {
          terms: {
            field: metricsMapping[by],
          },
          aggs: {
            activity: {
              date_histogram: Object.assign(
                {
                  field: 'request.time',
                  interval: `${step}s`,
                  min_doc_count: 0,
                },
                query.start && query.end
                  ? {
                      extended_bounds: {
                        min: query.start * 1000,
                        max: query.end * 1000,
                      },
                    }
                  : {}
              ),
            },
          },
        },
      },
      limit: 0,
      filter,
    }),
    'log'
  ).then(({ aggregations: { metrics: { buckets } } }) =>
    buckets.reduce((metrics, { key: metricsKey, activity }) => {
      return activity.buckets.map(({ key, doc_count }, i) => [
        Math.ceil(key / 1000),
        Object.assign(metrics[i] ? metrics[i][1] : {}, {
          [metricsKey]: doc_count,
        }),
      ]);
    }, [])
  );
};

const searchSessions = ({
  fetchFn,
  sessionId,
  queryConstants = {},
  type,
}) => client => (query = {}) => {
  const { start, end, filter } = query;
  const activityRange =
    start && end
      ? {
          gte: start * 1000,
          lte: end * 1000,
        }
      : {
          gte: (now() - 14 * 60) * 1000,
        };
  const activityBounds = {
    min: activityRange.gte,
    max: activityRange.lte || now() * 1000,
  };
  const activityInterval = Math.ceil(
    Math.max(Math.floor((activityBounds.max - activityBounds.min) / 1000), 14) /
      14
  );
  let must;
  const ruleTypeFilter = filter['rule.type'];
  if (ruleTypeFilter) {
    let matchingRules;
    if (ruleTypeFilter.exists) {
      matchingRules = rules.list();
    } else {
      matchingRules = ruleTypeFilter.values.reduce(
        (matches, value) => matches.merge(rules.list(value)),
        new Map()
      );
    }
    const matcher = rulesMatchers[type];
    const filterKey = matcher.join('.');
    const ruleFilter = matchingRules
      .filter(rule => rule.getIn(['condition', 'type']) === type)
      .reduce((filter, rule) => {
        if (!filter[filterKey]) {
          filter[filterKey] = { values: [], negative: ruleTypeFilter.negative };
        }
        filter[filterKey].values.push(rule.get('condition').getIn(matcher));
        return filter;
      }, {});
    if (Object.keys(ruleFilter).length === 0 && !ruleTypeFilter.negative) {
      return [];
    }
    must = getMustFromFilter(ruleFilter, type);
  }
  return search(client)(
    Object.assign(
      {
        aggs: {
          sessions: {
            terms: {
              field: sessionId,
              size: query.limit || 50,
            },
            aggs: Object.assign(
              {
                request_time_filter: {
                  filter: {
                    range: {
                      'request.time': activityRange,
                    },
                  },
                  aggs: {
                    activity: {
                      date_histogram: {
                        field: 'request.time',
                        interval: `${activityInterval}s`,
                        min_doc_count: 0,
                        extended_bounds: activityBounds,
                      },
                    },
                  },
                },
                latest_request: {
                  top_hits: {
                    sort: {
                      'request.time': {
                        order: 'desc',
                      },
                    },
                    _source: {
                      includes: ['request.time', 'identity', 'user_agent'],
                    },
                    size: 1,
                  },
                },
              },
              query.sort === 'speed'
                ? {
                    activity_bucket_sort: {
                      bucket_sort: {
                        sort: {
                          'request_time_filter>_count': {
                            order: 'desc',
                          },
                        },
                      },
                    },
                  }
                : {}
            ),
          },
        },
        limit: 0,
      },
      queryConstants,
      query,
      must
        ? {
            must,
            filter: omit(query.filter, 'rule.type'),
          }
        : {}
    ),
    type
  )
    .then(({ aggregations: { sessions: { buckets } } }) =>
      buckets.map(({ key, doc_count, request_time_filter, latest_request }) => {
        const latestRequest = latest_request.hits.hits[0]._source;
        return {
          id: key,
          count: doc_count,
          speed: {
            per_minute: request_time_filter.activity.buckets
              .map(({ doc_count }) => doc_count)
              .reverse(),
          },
          end: latestRequest.request.time,
          identity: latestRequest.identity,
          user_agents: [latestRequest.user_agent],
        };
      })
    )
    .then(sessions =>
      Promise.all(sessions.map(({ id }) => fetchFn(id))).then(sessionsData =>
        sessionsData.map((sessionData, i) => ({
          es: sessions[i],
          hub: sessionData,
        }))
      )
    );
};

const searchRobots = searchSessions({
  queryConstants: {
    'identity.type': 'robot',
  },
  fetchFn: id =>
    getSession({ type: 'robot', id, immutable: false }).then(
      ({ robot }) => robot
    ),
  sessionId: 'robot.id',
  type: 'robot',
});

const searchAddresses = searchSessions({
  fetchFn: address =>
    getSession({
      type: 'address',
      id: address,
      immutable: false,
      options: {
        include_robots: 1,
      },
    }).then(({ address }) => address),
  sessionId: 'address.value',
  type: 'address',
});

const logsEndpoint = client => {
  const search = searchLogs(client);
  return (req, res) => {
    const { query } = req;
    search(query).then(logs => res.send(logs));
  };
};

const elasticSearchBuilder = config => {
  const esClient = new elasticsearch.Client(config);
  const gc = indexesGc(esClient);
  monitor.status = 'Started';
  setImmediate(gc);
  setInterval(gc, 24 * 3600 * 1000);
  return {
    index: indexLog(esClient),
    searchLogs: searchLogs(esClient),
    searchMetrics: searchMetrics(esClient),
    searchRobots: searchRobots(esClient),
    searchAddresses: searchAddresses(esClient),
    logsEndpoint: logsEndpoint(esClient),
  };
};

module.exports = elasticSearchBuilder;
