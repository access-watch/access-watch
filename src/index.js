const merge = require('lodash.merge');

const constants = require('./constants');

module.exports = (config = {}) => {
  merge(constants, config);

  // Load modules
  Object.keys(constants.modules).forEach(key => {
    if (constants.modules[key]) {
      require(`./modules/${key}`);
    }
  });

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
