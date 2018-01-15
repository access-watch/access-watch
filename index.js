const merge = require('lodash.merge');

const constants = require('./config/constants');

module.exports = (config = {}) => {
  merge(constants, config);

  // Database instances
  const databases = {
    metrics: require('./lib/metrics').connect(),
    session: require('./lib/session').connect(),
    rules: require('./lib/rules').connect(),
  };

  // Express Apps (not mounted)
  const api = require('./lib/api');
  const dashboard = require('./dashboard');

  // Libraries
  const pipeline = require('./lib/pipeline');
  const util = require('./lib/util');

  // Plugins
  const plugins = require('./plugins');

  return {
    constants,
    pipeline,
    util,
    api,
    dashboard,
    databases,
    plugins,
  };
};
