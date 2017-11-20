const uuid = require('uuid/v4')
const { Set, Map, fromJS } = require('immutable')

const pipeline = require('../lib/pipeline')

const reducers = require('../lib/reducers')
const session = require('../lib/session')
const { selectKeys } = require('../lib/util')
const { FixedWindow } = require('../lib/window')

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
    reducer: reducers.count()
  })
  .store()

// Robots

// Split the stream by session and augment each log with the session data
const robotRequests = stream.session({
  type: 'robot',
  gap: 30 * 60,
  id: log => log.getIn(['robot', 'id'])
})

robotRequests
  .map(log => {
    return log.update('session', session => {
      const cnt = session.get('count', 0) + 1
      const duration = session.get('updated') - session.get('start')
      const speedInSeconds = (duration === 0) ? cnt : cnt / duration
      return session
        .set('robot', log.getIn(['robot']))
        .set('identity', log.get('identity')
             .update('type', t => (t === 'unknown') ? null : t))
        .set('address', log.getIn(['address']))
        .set('user_agent', log.getIn(['user_agent']))
        .set('reputation', log.getIn(['robot', 'reputation']))
        .set('count', cnt)
        .set('speed', Map({
          per_second: speedInSeconds,
          per_minute: speedInSeconds * 60
        }))
    })
  })
  .map(log => {
    session.save(log.get('session'))
    return log
  })

// IPs

const ipRequests = stream.session({
  type: 'address',
  gap: 30 * 60,
  id: log => log.getIn(['address', 'value'])
})

ipRequests
  .map(log => {
    return log.update('session', session => {
      const cnt = session.get('count', 0) + 1
      const duration = session.get('updated') - session.get('start')
      const speedInSeconds = (duration === 0) ? cnt : cnt / duration
      return session
        .set('address', log.get('address'))
        .update('robots', Set(), robots => robots.add(log.getIn(['robot', 'id'])))
        .set('count', cnt)
        .set('speed', Map({
          per_second: speedInSeconds,
          per_minute: speedInSeconds * 60
        }))
    })
  })
  .map(log => {
    session.save(log.get('session'))
    return log
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
