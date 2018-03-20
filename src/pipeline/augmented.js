const uuid = require('uuid/v4');
const { Map } = require('immutable');

const { now } = require('../lib/util');
const pipeline = require('../lib/pipeline');
const instruments = require('../lib/instruments');

const hub = require('../plugins/hub');
const proxy = require('../plugins/proxy');

const augmented = pipeline

  // Set a UUID if no one is defined
  .map(log => {
    if (!log.has('uuid')) {
      log = log.set('uuid', uuid());
    }
    return log;
  })

  // Detect the public IP address if it's behind a proxy
  .map(log =>
    log.set(
      'address',
      proxy.detectAddress(
        log.getIn(['request', 'address']),
        log.getIn(['request', 'headers'])
      )
    )
  )

  // Augment with data from the Access Watch Hub
  .map(log => hub.augment(log))

  // Instruments (out)
  .map(log => {
    instruments.increment('pipeline.augmented.out');
    instruments.gauge(
      'pipeline.augmented.delta',
      Math.floor(new Date(log.getIn(['request', 'time'])).getTime() / 1000) -
        now()
    );
    return log;
  })
  // Handle anonymous robots
  .map(log => {
    if (log.getIn(['identity', 'type']) === 'robot' && !log.has('robot')) {
      log = log.set(
        'robot',
        new Map({
          id: log.getIn(['identity', 'id']),
          name: log.getIn(['user_agent', 'agent', 'label'], 'Unknown'),
          reputation: {
            status: log.getIn(['reputation', 'status']),
          },
        })
      );
    }
    return log;
  });

module.exports = { stream: augmented };
