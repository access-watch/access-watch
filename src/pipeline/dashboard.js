const { stream } = require('../pipeline/augmented');

const websocket = stream

  // Filter logs without identity
  .filter(log => log.hasIn(['identity', 'id']))

  // Normalise unknown identity as null
  .map(log => {
    if (log.getIn(['identity', 'type']) === 'unknown') {
      log = log.setIn(['identity', 'type'], null);
    }
    return log;
  })

  // Set session id
  .map(log => {
    if (log.hasIn(['robot', 'id'])) {
      log = log.setIn(['session', 'id'], log.getIn(['robot', 'id']));
    } else if (log.hasIn(['identity', 'id'])) {
      log = log.setIn(['session', 'id'], log.getIn(['identity', 'id']));
    }
    return log;
  });

module.exports = { stream: websocket };
