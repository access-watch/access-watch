const rules = require('./lib/rules').connect();
const session = require('./lib/session').connect();
const metrics = require('./lib/metrics').connect();
const searches = require('./lib/searches').connect();

session.setRulesProvider(rules);

module.exports = { rules, session, metrics, searches };
