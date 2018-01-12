const merge = require('lodash.merge');

const constants = require('./config/constants');

module.exports = (config = {}) => {
  merge(constants, config);

  const pipeline = require('./lib/pipeline');
  const api = require('./lib/api');
  const util = require('./lib/util');
  const dashboard = require('./dashboard');

  return { pipeline, api, dashboard, util, constants };
};
