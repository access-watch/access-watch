const registerLogsProvider = require('../apps/register_logs_provider');
const memoryLogsProvider = require('./memory_logs');

const lib = {
  database: require('./database'),
  pipeline: require('./pipeline'),
  util: require('./util'),
};

registerLogsProvider(memoryLogsProvider);

module.exports = lib;
