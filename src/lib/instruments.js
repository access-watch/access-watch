const appmetrics = require('appmetrics');

appmetrics.configure({ mqtt: 'off' });

const appmetricsStatsD = require('appmetrics-statsd');

const config = require('../constants');

const instruments = {};

let statsd;

if (config.statsd) {
  statsd = appmetricsStatsD.StatsD(config.statsd);
}

instruments.increment = (...args) => {
  if (statsd) return statsd.increment(...args);
};

instruments.gauge = (...args) => {
  if (statsd) return statsd.gauge(...args);
};

instruments.set = (...args) => {
  if (statsd) return statsd.set(...args);
};

instruments.timing = (...args) => {
  if (statsd) return statsd.timing(...args);
};

instruments.hrtime = (key, start) => {
  const end = process.hrtime(start);
  const elapsed = end[0] * 1000 + Math.round(end[1] / 1000000);
  instruments.timing(key, elapsed);
};

module.exports = instruments;
