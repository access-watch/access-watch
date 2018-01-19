const elasticSearchBuilder = require('../plugins/elasticsearch');
const register = require('../apps/register_logs_provider');
const elasticsearch = elasticSearchBuilder();

register(elasticsearch);
