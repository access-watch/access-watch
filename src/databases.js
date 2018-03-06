const rules = require('./lib/rules').connect();
const session = require('./lib/session').connect();

session.setRulesProvider(rules);
const databases = {
  metrics: require('./lib/metrics').connect(),
  session,
  rules,
  searches: require('./lib/searches').connect(),
};

module.exports = databases;
