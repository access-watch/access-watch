const merge = require('lodash.merge');

const constants = require('./constants');

module.exports = (config = {}) => {
  merge(constants, config);

  // Load modules
  Object.keys(constants.modules)
    .map(key => Object.assign({ key }, constants.modules[key]))
    .sort((a, b) => b.priority - a.priority)
    .forEach(({ key }) => {
      // Here we need to access from the object as module with higer
      // priority can deactivate modules with lower
      if (constants.modules[key].active) {
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
