//
// Plugin to discuss with the Access Watch Hub
//

const LRU = require('lru-cache')
const request = require('axios')
const { fromJS } = require('immutable')

const { signature } = require('access-watch-sdk')

const HUB_ENDPOINT = 'https://api.access.watch/1.2/hub'
const REQUEST_TIMEOUT = 5000

const cache = LRU({size: 10000, maxAge: 3600 * 1000})

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
      buffer[key] = {identity: identity, promises: []}
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
  return request({
    method: 'POST',
    url: HUB_ENDPOINT + '/identities',
    data: JSON.stringify({identities}),
    timeout: REQUEST_TIMEOUT
  }).then(response => {
    if (typeof response.data !== 'object') {
      throw new Error('Response not an object')
    }
    if (!response.data.identities || !Array.isArray(response.data.identities)) {
      throw new Error('Response identities not an array')
    }
    return response.data.identities
  })
}

module.exports = {
  fetchIdentity: fetchIdentity
}
