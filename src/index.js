const merge = require('lodash.merge');

const constants = require('./constants');

module.exports = (config = {}) => {
  merge(constants, config);

  // Modules
  require('./modules/metrics');
  require('./modules/session');
  require('./modules/rules');

  // Databases
  const databases = {
    metrics: require('./lib/metrics').connect(),
    session: require('./lib/session').connect(),
    rules: require('./lib/rules').connect(),
  };

  // Apps (not mounted)
  const apps = {
    api: require('./lib/api'),
    websocket: require('./lib/websocket'),
    dashboard: require('./dashboard'),
  };

  // Libraries
  const app = require('./lib/app');
  const pipeline = require('./lib/pipeline');
  const database = require('./lib/database');
  const util = require('./lib/util');

  // Plugins
  const plugins = require('./plugins');

  return {
    constants,
    app,
    pipeline,
    database,
    util,
    apps,
    databases,
    plugins,
  };
};
