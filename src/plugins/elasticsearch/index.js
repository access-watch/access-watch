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
  new Date(new Date().getTime() - (expiration + 1) * 24 * 3600 * 1000);

/**
 * Keep track of the existing indexes
 */
const indexesDb = {};

/**
 * Match older "session" types with logs in Elasticsearch
 */
const sessionsIds = {
  address: 'address.value',
  robot: 'robot.id',
};

const reportIndexNotFound = location => {
  console.warn(
    `Elasticsearch plugin warning: Could not find data in ${location}, either no logs have been indexed yet or there is an index misconfiguration`
  );
};

/**
 * Catch errors in the promise.
 * Display errors to the input monitoring and the console
 *
 * @param {promise} promise
 * @return {promise}
 */
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

/**
 *
 * @param {object} client
 * @return {function}
 */
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

/**
 * Delete older indexes based on the configured expiration
 */
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

/**
 * Create a case insensitive regexp value
 * (case insensitivity is not generally available with Elasticsearch wildcards)
 */
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

/**
 * Get the elasticsearch search query value based on our internal schema
 * (full-text search or exact match)
 */
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

/**
 * Transform the filters sent by the frontend to an Elasticsearch must condition
 *
 * @param {object} filter
 * @param {string} type log|session|address
 *
 * @return {object}
 */
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

/**
 * Search in the Elasticsearch indexes converting a frontend query to elasticsearch
 *
 * query example:
 * {
 *   start: '1521476609',
 *   end: '1521476864',
 *   filter: { 'identity.type': { id: 'identity.type', values: ['robot'] } },
 * }
 *
 * @return {promise} Elasticsearch search
 */
const search = client => (query = {}, type) => {
  const { start, end, limit: size, aggs, filter, must } = query;
  // We always only search for entries with an identity object
  // (signal for augmented log entries)
  let bool = {
    filter: [
      {
        exists: {
          field: 'identity.id',
        },
      },
    ],
  };
  // We always sort by time in reverse order
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
    } else {
      reportIndexNotFound('logs');
      return [];
    }
  });

/**
 * Match older "metrics" types with logs in Elasticsearch
 */
const metricsMapping = {
  status: 'robot.reputation.status',
  type: 'identity.type',
  country: 'address.country_code',
};

/**
 * Search function to compute the metrics from elasticsearch
 *
 * Query example:
 * {
 *   start: '1521476609',
 *   end: '1521476864',
 *   by: 'country',
 *   status: 'bad',
 *   type: 'robot',
 * }
 * The extra fields (in this query status and type) should match one of the fields of metricsMapping
 * and are used for filtering
 * The by is used for aggregating
 *
 * @return {promise} Metrics array [[timeInSeconds, { metric1Value: number, metric2Value: number}]]
 */
const searchMetrics = client => (query = {}) => {
  const { step, by } = query;
  // Avoid mutations of the original filter
  const filter = Object.assign({}, query.filter || {});

  // Creating the filters
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
                // If it is a timerange query, we want to have every single point in the interval
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
  ).then(({ aggregations }) => {
    if (aggregations) {
      const { metrics: { buckets } } = aggregations;
      // Transform elasticsearch output to a front-end compatible output with tuples
      // [timeInSeconds, { metric1Value: number, metric2Value: number}]
      return buckets.reduce((metrics, { key: metricsKey, activity }) => {
        return activity.buckets.map(({ key, doc_count }, i) => [
          Math.ceil(key / 1000),
          Object.assign(metrics[i] ? metrics[i][1] : {}, {
            [metricsKey]: doc_count,
          }),
        ]);
      }, []);
    } else {
      reportIndexNotFound('metrics');
      return [];
    }
  });
};

/**
 * Search function to compute the sessions from elasticsearch
 * This is an abstract search that can look for either robot or address
 * by the help of the fetchFn, sessionId, queryConstants and type
 *
 * @param {function} fetchFn function to fetch the session from the database to get extra infos about the session
 * @param {sessionId} string the field used as a sessionId
 * @param {queryConstants} object extra query parameter that are needed for this particular session
 * @param {type} string Session type : address|robot
 *
 * @return {promise} { es: fields computed by elasticsearch, hub: fields computed by hub}
 *
 * Query example (same as search):
 * {
 *   start: 1521476609,
 *   end: 1521476864,
 *   step: 10,
 * }
 * Step is used to compute the global activity of the session over the timerange (used in the display of activityList)
 */
const searchSessions = ({
  fetchFn,
  sessionId,
  queryConstants = {},
  type,
}) => client => (query = {}) => {
  const { start, end, step, filter } = query;
  // Range of the activity (last 15 minutes or the timerange if the query contains a timerange)
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
  // Activity interval : we are always asking for 15 points (activity sparkline)
  const activityInterval = Math.ceil(
    Math.max(Math.floor((activityBounds.max - activityBounds.min) / 1000), 14) /
      14
  );
  // The recent activity aggregation (used for the activity sparkline)
  const recentActivityAgg = Object.assign(
    {
      request_time_filter: {
        filter: {
          range: {
            'request.time': activityRange,
          },
        },
        aggs: {
          recent_activity: {
            date_histogram: {
              field: 'request.time',
              interval: `${activityInterval}s`,
              min_doc_count: 0,
              extended_bounds: activityBounds,
            },
          },
        },
      },
      // We also extract the top latest request to have userAgent, the lastUpdated field and the identity
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
  );
  // The activity aggregation to be displayed in activityList
  const globalActivityAgg = step
    ? {
        global_activity: {
          date_histogram: {
            field: 'request.time',
            interval: `${step}s`,
            min_doc_count: 0,
            extended_bounds: {
              min: start * 1000,
              max: (end || now()) * 1000,
            },
          },
        },
      }
    : {};
  let must;
  // We have to transform the rule filtering as elasticsearch logs do not contain rules
  const ruleTypeFilter = filter['rule.type'];
  if (ruleTypeFilter) {
    let matchingRules;
    if (ruleTypeFilter.exists) {
      matchingRules = rules.list();
    } else {
      matchingRules = ruleTypeFilter.values.reduce(
        (matches, value) => matches.merge(rules.list(value)),
        Map()
      );
    }
    const ruleFilter = matchingRules
      // We only want the rules which are for the current selected session type
      .filter(rule => rule.getIn(['condition', 'type']) === type)
      .reduce((filter, rule) => {
        const matcher = rulesMatchers[type];
        const filterKey = matcher.join('.');
        if (!filter[filterKey]) {
          filter[filterKey] = { values: [], negative: ruleTypeFilter.negative };
        }
        filter[filterKey].values.push(rule.get('condition').getIn(matcher));
        return filter;
      }, {});
    // If we found 0 rules and the filter is not negative, it means no sessions should match
    // But elasticsearch will not know about this, so we need to return early
    if (Object.keys(ruleFilter).length === 0 && !ruleTypeFilter.negative) {
      return Promise.resolve([]);
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
            aggs: Object.assign({}, globalActivityAgg, recentActivityAgg),
          },
        },
        limit: 0,
      },
      queryConstants,
      query,
      must
        ? {
            must,
            filter: omit(filter, 'rule.type'),
          }
        : {}
    ),
    type
  )
    .then(({ aggregations }) => {
      if (aggregations) {
        const { sessions: { buckets } } = aggregations;
        return buckets.map(
          ({
            key,
            doc_count,
            request_time_filter,
            latest_request,
            global_activity,
          }) => {
            const latestRequest = latest_request.hits.hits[0]._source;
            return Object.assign(
              {
                id: key,
                count: doc_count,
                speed: {
                  per_minute: request_time_filter.recent_activity.buckets
                    .map(({ doc_count }) => doc_count)
                    .reverse(),
                },
                end: latestRequest.request.time,
                identity: latestRequest.identity,
                user_agents: [latestRequest.user_agent],
              },
              step
                ? {
                    activity: global_activity.buckets
                      .map(({ key, doc_count }) => [key, doc_count])
                      .reverse(),
                  }
                : {}
            );
          }
        );
      } else {
        reportIndexNotFound('sessions');
        return [];
      }
    })
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
  sessionId: sessionsIds.robot,
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
  sessionId: sessionsIds.address,
  type: 'address',
});

/**
 * Search function to find the addreses matching some robots
 *
 * @param {array} robotIds array of the robot ids
 *
 * @return {promise} object with keys robotId and value array of address' values
 *
 */
const searchRobotsAddresses = client => robotIds =>
  search(client)(
    {
      aggs: {
        robots: {
          terms: {
            field: sessionsIds.robot,
            size: robotIds.length,
          },
          aggs: {
            addresses: {
              terms: {
                field: sessionsIds.address,
                // NB: An aggregation needs a size so we would return a maximum of 10000 addresses per robot
                size: 10000,
              },
            },
          },
        },
      },
      filter: {
        [sessionsIds.robot]: {
          id: sessionsIds.robot,
          values: robotIds,
        },
      },
    },
    'robot'
  ).then(({ aggregations }) => {
    if (aggregations) {
      const { robots: { buckets } } = aggregations;
      return buckets.reduce(
        (robotsAddresses, { key, addresses }) =>
          Object.assign(robotsAddresses, {
            [key]: addresses.buckets.map(({ key }) => key),
          }),
        {}
      );
    } else {
      reportIndexNotFound('robotsAddresses');
      return [];
    }
  });

const logsEndpoint = client => {
  const search = searchLogs(client);
  return (req, res) => {
    const { query } = req;
    search(query).then(logs => res.send(logs));
  };
};

/**
 * Factory function for our elasticsearch searches instance
 * Instantiate an elasticsearch client and exposes the different possible
 * methods providing them with the clientX
 *
 * @param {array} robotIds array of the robot ids
 *
 * @return {object} elasticsearch client with methods
 */
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
    searchRobotsAddresses: searchRobotsAddresses(esClient),
  };
};

module.exports = elasticSearchBuilder;
