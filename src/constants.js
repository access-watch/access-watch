const rc = require('rc');
const path = require('path');

const constants = {
  port: 3000,
  pipeline: {
    allowedLateness: 60,
    watermarkDelay: 5,
  },
  data: {
    protocol: 'file',
    directory: path.resolve(__dirname, '../data'),
  },
  metrics: {
    gc: {
      expiration: 24 * 3600,
      interval: 60 * 1000,
    },
  },
  rules: {
    gc: {
      expiration: 24 * 3600,
      interval: 60 * 1000,
    },
  },
  session: {
    gc: {
      indexSize: 1000,
      expiration: 3600,
      interval: 60 * 1000,
    },
  },
  hub: {
    cache: {
      max: 10000,
      maxAge: 3600 * 1000,
    },
    identity: {
      batchInterval: 333,
      maxConcurrentRequests: 2,
    },
    activity: {
      batchInterval: 333,
      maxConcurrentRequests: 2,
    },
    timeout: 1000,
  },
  ui: {
    time: {
      sliderValues: ['auto', 30, 60, 60 * 6, 60 * 24],
    },
  },
  elasticsearch: {
    retention: 5,
    logsIndexName: 'access-watch-logs',
    configuration: {},
  },
  modules: {
    elasticsearch: false,
  },
};

module.exports = rc('access-watch', constants);
