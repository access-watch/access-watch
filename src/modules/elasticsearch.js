const config = require('../constants');
const elasticSearchBuilder = require('../plugins/elasticsearch');
const register = require('../apps/register_logs_provider');
const elasticsearch = elasticSearchBuilder(config.elasticsearch.configuration);

register(elasticsearch);
