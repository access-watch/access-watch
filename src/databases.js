const databases = {
  metrics: require('./lib/metrics').connect(),
  session: require('./lib/session').connect(),
  rules: require('./lib/rules').connect(),
};

module.exports = databases;
