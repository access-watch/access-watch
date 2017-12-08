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

module.exports = {
  fetchIdentity
}
