const rc = require('rc');
const path = require('path');

const constants = {
  port: 3000,
  app: {},
  pipeline: {
    allowedLateness: 60,
    watermarkDelay: 5,
  },
  data: {
    protocol: 'file',
    directory: path.resolve(__dirname, '../data'),
    saveInterval: 60 * 60 * 1000,
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
    timerange: false,
  },
  hub: {
    cache: {
      max: 10000,
      maxAge: 3600 * 1000,
    },
    identity: {
      batchInterval: 333,
      maxConcurrentRequests: 3,
    },
    activity: {
      batchInterval: 333,
      maxConcurrentRequests: 3,
    },
    timeout: 2000,
  },
  ui: {
    time: {
      sliderValues: ['auto', 30, 60, 60 * 6, 60 * 24],
    },
  },
  elasticsearch: {
    expiration: 7,
    logsIndexName: 'access-watch-logs',
    configuration: {},
  },
  modules: {
    metrics: {
      active: true,
      priority: 0,
    },
    session: {
      active: true,
      priority: 0,
    },
    rules: {
      active: true,
      priority: 0,
    },
    logs: {
      active: true,
      priority: 0,
    },
    elasticsearch: {
      active: false,
      priority: 100,
    },
    searches: {
      active: true,
      priority: 0,
    },
  },
  logs: {
    memory: {
      retention: 1000,
    },
  },
  features: {
    anonymousRobots: false
  }
};

module.exports = rc('access-watch', constants);
