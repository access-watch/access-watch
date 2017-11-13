const { Map } = require('immutable')

const pipeline = require('../lib/pipeline')
const { selectKeys } = require('../lib/util')

const proxy = require('../plugins/proxy')
const hub = require('../plugins/hub')

pipeline

  // Filter requests
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
  // .map(log => console.log(log.toJS()))
