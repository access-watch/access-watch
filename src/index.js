const merge = require('lodash.merge');

const constants = require('./constants');

module.exports = (config = {}) => {
  merge(constants, config);

  // Modules
  require('./modules/metrics');
  require('./modules/session');
  require('./modules/rules');

  // Apps (not mounted)
  const apps = {
    api: require('./lib/api'),
    websocket: require('./lib/websocket'),
    dashboard: require('./dashboard'),
  };

  // Libraries
  const pipeline = require('./lib/pipeline');
  const database = require('./lib/database');
  const util = require('./lib/util');

  // Databases
  const databases = require('./databases');

  // Plugins
  const plugins = require('./plugins');

  return {
    constants,
    pipeline,
    database,
    util,
    apps,
    databases,
    plugins,
  };
};
