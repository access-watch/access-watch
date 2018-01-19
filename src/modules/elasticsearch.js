const config = require('../constants');
const elasticSearchBuilder = require('../plugins/elasticsearch');
const register = require('../apps/register_logs_provider');
const elasticsearch = elasticSearchBuilder(config.elasticsearch.configuration);

// As we are using elasticsearch, we don't need to use the memory to hold logs
config.logs.memory.retention = 0;

register(elasticsearch);
