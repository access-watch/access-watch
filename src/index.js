const merge = require('lodash.merge');

const constants = require('./constants');

module.exports = (config = {}) => {
  merge(constants, config);

  // Modules
  require('./modules/metrics');
  require('./modules/session');
  require('./modules/rules');

  // Lib
  const lib = require('./lib');

  // Apps
  const apps = require('./apps');

  // Databases
  const databases = require('./databases');

  // Plugins
  const plugins = require('./plugins');

  return Object.assign(
    {
      constants,
      apps,
      databases,
      plugins,
    },
    lib
  );
};
