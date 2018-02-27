const databases = {
  metrics: require('./lib/metrics').connect(),
  session: require('./lib/session').connect(),
  rules: require('./lib/rules').connect(),
  filterGroups: require('./lib/filter-groups').connect(),
};

module.exports = databases;
