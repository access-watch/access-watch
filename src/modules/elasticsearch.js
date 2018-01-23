const config = require('../constants');
const { stream } = require('../pipeline/augmented');
const elasticSearchBuilder = require('../plugins/elasticsearch');
const app = require('../apps/api');
const elasticsearch = elasticSearchBuilder(config.elasticsearch.configuration);

stream.map(log => elasticsearch.index(log));

app.get('/logs', elasticsearch.logsEndpoint);
