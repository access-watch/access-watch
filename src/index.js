const merge = require('lodash.merge');

const constants = require('./constants');

module.exports = (config = {}) => {
  merge(constants, config);
  // Modules
  if (constants.modules.elasticsearch) {
    require('./modules/elasticsearch');
  }
  require('./modules/metrics');
  require('./modules/session');
  require('./modules/rules');
  require('./modules/logs');

  const lib = require('./lib');

  const apps = require('./apps');
  const databases = require('./databases');
  const plugins = require('./plugins');
  const format = require('./format');
  const input = require('./input');

  return Object.assign(
    {
      constants,
      apps,
      databases,
      plugins,
      format,
      input,
    },
    lib
  );
};
