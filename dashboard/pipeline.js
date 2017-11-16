const uuid = require('uuid/v4')
const { Map, fromJS } = require('immutable')

const pipeline = require('../lib/pipeline')

const reducers = require('../lib/reducers')
const { selectKeys } = require('../lib/util')
const { FixedWindow, SessionWindow } = require('../lib/window')

const hub = require('../plugins/hub')
const proxy = require('../plugins/proxy')

// Pre-Processing before Analytics & Robots

let stream = pipeline

  // .filter(log => log.getIn(['request', 'host']) === 'example.com')

  // Detect the public IP address if it's behind a proxy
  .map(log => log.set('address',
                        proxy.detectAddress(log.getIn(['request', 'address']),
                                            log.getIn(['request', 'headers']))))

  // Augment with data from the Access Watch Hub
  .map(log => {
    return hub.fetchIdentity(Map({
      address: log.getIn(['address', 'value']),
      headers: log.getIn(['request', 'headers']),
      captured_headers: log.getIn(['request', 'captured_headers'])
    })).then(identity => {
      if (identity) {
        // Add identity properties
        log = log.set('identity', selectKeys(identity, ['id', 'type', 'label']))
        // Add identity objects
        ;['address', 'user_agent', 'robot', 'reputation'].forEach(key => {
          if (identity.has(key)) {
            log = log.set(key, identity.get(key))
          }
        })
      }
      return log
    })
  })

// Output to the console as JS object
// stream.map(log => console.log(log.toJS()))

// Analytics

function requestMetrics (log) {
  return fromJS({
    name: 'request',
    tags: {
      type: log.getIn(['identity', 'type'], 'unknown'),
      status: log.getIn(['reputation', 'status'], 'ok'),
      country: log.getIn(['address', 'country_code'], 'unknown')
    },
    value: 1
  })
}

stream
  .metrics(requestMetrics)
  .window({
    strategy: new FixedWindow(1),
    reducer: reducers.count(),
  })
  .store()

// Robots

function robotSession (log) {
  if (log.hasIn(['robot', 'id'])) {
    return fromJS({
      id: log.getIn(['robot', 'id']),
      robot: log.getIn(['robot']),
      identity: log.get('identity')
        .update('type', t => (t === 'unknown') ? null : t),
      address: log.getIn(['address']),
      user_agent: log.getIn(['user_agent']),
      reputation: log.getIn(['robot', 'reputation']),
      count: 0
    })
  }
}

// Split the stream by session and augment each log with the session data
const robotRequests = stream.session(robotSession)

// Count the requests per session and update the session store
robotRequests
  .window({
    strategy: new SessionWindow(30 * 60),
    reducer: reducers.count(),
    fireEvery: 5
  })
  .sessionUpdate(metric => {
    return session => {
      return session.set('count', metric.get('value'))
    }
  })

// We count the number of requests per minute for each robot
// so that we can store the speed in the session
robotRequests
  .window({
    strategy: new FixedWindow(60),
    reducer: reducers.count(),
  })
  .sessionUpdate(metric => {
    return session => {
      return session.set('speed', Map({
        per_second: metric.get('value') / 60,
        per_minute: metric.get('value')
      }))
    }
  })

// Post-Processing for Websocket logs

stream = stream
  // Filter logs without identity
  .filter(log => log.hasIn(['identity', 'id']))
  // Set a UUID if no one is defined
  .map(log => {
    if (!log.has('uuid')) {
      log = log.set('uuid', uuid())
    }
    return log
  })
  // Set top level time as iso
  .map(log => {
    return log.set('time', log.getIn(['request', 'time']))
  })
  // Set request host
  .map(log => {
    if (!log.hasIn(['request', 'host']) && log.hasIn(['request', 'headers', 'host'])) {
      log = log.setIn(['request', 'host'], log.getIn(['request', 'headers', 'host']))
    }
    return log
  })
  // Normalise unknown identity as null
  .map(log => {
    if (log.getIn(['identity', 'type']) === 'unknown') {
      log = log.setIn(['identity', 'type'], null)
    }
    return log
  })
  // Set identity name
  .map(log => {
    if (!log.hasIn(['identity', 'name']) && log.hasIn(['identity', 'robot', 'name'])) {
      log = log.setIn(['identity', 'name'], log.getIn(['identity', 'robot', 'name']))
    }
    return log
  })
  // Set address label
  .map(log => {
    if (!log.hasIn(['address', 'label'])) {
      log = log.setIn(['address', 'label'], log.getIn(['address', 'hostname']) || log.getIn(['address', 'value']))
    }
    return log
  })
  // Set session id
  .map(log => {
    if (log.hasIn(['robot', 'id'])) {
      log = log.setIn(['session', 'id'], log.getIn(['robot', 'id']))
    } else if (log.hasIn(['identity', 'id'])) {
      log = log.setIn(['session', 'id'], log.getIn(['identity', 'id']))
    }
    return log
  })

// Output to the console as JS object
// stream.map(log => console.log(log.toJS()))

module.exports = {
  stream
}
