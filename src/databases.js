const databases = {
  metrics: require('./lib/metrics').connect(),
  session: require('./lib/session').connect(),
  rules: require('./lib/rules').connect(),
  searches: require('./lib/searches').connect(),
};

module.exports = databases;
