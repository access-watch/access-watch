//
// Plugin to discuss with the Access Watch Hub
//

const LRUCache = require('lru-cache')
const axios = require('axios')
const { fromJS } = require('immutable')

const { signature } = require('access-watch-sdk')

const client = axios.create({
  baseURL: 'https://api.access.watch/1.2/hub',
  timeout: 1000,
  headers: {'User-Agent': 'Access Watch Hub Plugin'}
})

const cache = new LRUCache({size: 10000, maxAge: 3600 * 1000})

let buffer = {}

let batchScheduled

function fetchIdentity (identity) {
  let key = cacheKey(identity)
  if (cache.has(key)) {
    return Promise.resolve(cache.get(key))
  } else {
    return fetchIdentityPromise(key, identity)
  }
}

function cacheKey (identity) {
  return signature.getIdentityId({
    address: identity.get('address'),
    headers: identity.get('headers').toJS()
  })
}

function fetchIdentityPromise (key, identity) {
  return new Promise((resolve, reject) => {
    if (Object.keys(buffer).length >= 100) {
      console.log('Buffer Full. Skipping augmentation.')
      resolve()
      return
    }
    if (!buffer[key]) {
      buffer[key] = {identity, promises: []}
    }
    buffer[key].promises.push({resolve, reject})
    if (!batchScheduled) {
      batchScheduled = setTimeout(fetchIdentityBatch, 333)
    }
  })
}

function fetchIdentityBatch () {
  batchScheduled = null

  let batch = []

  // Move entries from the buffer to the batch
  Object.keys(buffer).forEach(key => {
    batch.push(Object.assign({key}, buffer[key]))
    delete buffer[key]
  })

  if (batch.length === 0) {
    return
  }

  const requestIdentities = batch.map(batchEntry => batchEntry.identity)

  getIdentities(requestIdentities)
    .then(responseIdentities => {
      if (batch.length !== responseIdentities.length) {
        throw new Error('Length mismatch')
      }
      batch.forEach((batchEntry, i) => {
        const identityMap = fromJS(responseIdentities[i])
        cache.set(batchEntry.key, identityMap)
        batchEntry.promises.forEach(({resolve}) => {
          resolve(identityMap.size ? identityMap : null)
        })
      })
    })
    .catch(() => {
      // Resolving all the requests with an empty response
      batch.forEach(batchEntry => {
        batchEntry.promises.forEach(({resolve}) => {
          resolve()
        })
      })
    })
}

function getIdentities (identities) {
  return client
    .post('/identities', {identities})
    .then(response => {
      if (typeof response.data !== 'object') {
        throw new TypeError('Response not an object')
      }
      if (!response.data.identities || !Array.isArray(response.data.identities)) {
        throw new TypeError('Response identities not an array')
      }
      return response.data.identities
    })
}

let activityBuffer = {}

const types = {
  '/robots.txt': 'robot',
  '/favicon.ico': 'favicon',
  '.png': 'img',
  '.gif': 'img',
  '.jpg': 'img',
  '.css': 'css',
  '.js': 'js'
}

function detectType (url) {
  let type = 'mixed'

  Object.keys(types).some(key => {
    if (url.slice(key.length * -1) === key) {
      type = types[key]
      return true
    }
  })

  return type
}

function activityFeedback (log) {
  // Get identity id
  let identityId = log.getIn(['identity', 'id'])
  if (!identityId) {
    identityId = signature.getIdentityId({
      address: log.get('address'),
      headers: log.get('headers').toJS()
    })
  }
  if (!activityBuffer[identityId]) {
    activityBuffer[identityId] = {}
  }

  // Get host
  let host = log.getIn(['request', 'headers', 'host'])
  if (!host) {
    return
  }
  if (host.indexOf(':') !== -1) {
    [host] = host.split(':')
  }
  if (!activityBuffer[identityId][host]) {
    activityBuffer[identityId][host] = {}
  }

  // Track methods
  const method = log.getIn(['request', 'method'])
  if (!activityBuffer[identityId][host][method]) {
    activityBuffer[identityId][host][method] = 1
  } else {
    activityBuffer[identityId][host][method] ++
  }

  // Track type
  const type = detectType(log.getIn(['request', 'url']))
  if (!activityBuffer[identityId][host][type]) {
    activityBuffer[identityId][host][type] = 1
  } else {
    activityBuffer[identityId][host][type] ++
  }
}

function batchIdentityFeedback () {
  let activity = {}

  Object.keys(activityBuffer).forEach(key => {
    activity[key] = Object.assign({}, activityBuffer[key])
    delete activityBuffer[key]
  })

  if (activity) {
    client
      .post('/activity', {activity})
      .then(response => {
        if (typeof response.data !== 'object') {
          throw new TypeError('Response not an object')
        }
        if (!response.data.identities || !Array.isArray(response.data.identities)) {
          throw new TypeError('Response identities not an array')
        }
        response.data.identities.forEach(identity => {
          const identityMap = fromJS(identity)
          if (cache.get(identity.id) !== identityMap) {
            cache.set(identity.id, identityMap)
          }
        })
      })
      .catch(err => {
        console.log('activity feedback', err)
      })
  }
}

setInterval(batchIdentityFeedback, 60 * 1000)

module.exports = {
  fetchIdentity,
  activityFeedback
}
