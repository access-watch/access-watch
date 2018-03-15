//
// Plugin to discuss with the Access Watch Hub
//

const LRUCache = require('lru-cache');
const axios = require('axios');
const uuid = require('uuid/v4');
const { Map, fromJS, is } = require('immutable');

const { signature, database } = require('access-watch-sdk');

const { selectKeys } = require('../lib/util');
const config = require('../constants');
const instruments = require('../lib/instruments');

const client = axios.create({
  baseURL: 'https://api.access.watch/1.2/hub',
  timeout: config.hub.timeout,
  headers: { 'User-Agent': 'Access Watch Hub Plugin' },
});

const cache = new LRUCache(config.hub.cache);

const identityBuffer = {};

const identityRequests = {};

function augment(log) {
  // Share activity metrics and get updates
  activityFeedback(log);
  // Fetch identity and augment log (promise based)
  return fetchIdentity(
    Map({
      address: log.getIn(
        ['address', 'value'],
        log.getIn(['request', 'address'])
      ),
      headers: log.getIn(['request', 'headers']),
      captured_headers: log.getIn(['request', 'captured_headers']),
    })
  ).then(identity => {
    if (identity) {
      // Add identity properties
      log = log.set('identity', selectKeys(identity, ['id', 'type', 'label']));
      // Add identity objects
      ['address', 'user_agent', 'robot', 'reputation'].forEach(key => {
        if (identity.has(key)) {
          log = log.set(key, identity.get(key));
        }
      });
    }
    return log;
  });
}

function fetchIdentity(identity) {
  let key = cacheKey(identity);
  if (cache.has(key)) {
    return Promise.resolve(cache.get(key));
  } else {
    return fetchIdentityPromise(key, identity);
  }
}

function cacheKey(identity) {
  return signature.getIdentityId(identity.toJS());
}

function fetchIdentityPromise(key, identity) {
  return new Promise((resolve, reject) => {
    const identityBufferCount = Object.keys(identityBuffer).length;
    if (identityBufferCount >= 25) {
      console.log('Identity buffer full. Skipping.', identityBufferCount);
      resolve();
      return;
    }
    if (!identityBuffer[key]) {
      identityBuffer[key] = { identity, promises: [] };
    }
    identityBuffer[key].promises.push({ resolve, reject });
  });
}

function batchIdentityFetch() {
  const countCurrentRequests = Object.keys(identityRequests).length;
  if (countCurrentRequests >= config.hub.identity.maxConcurrentRequests) {
    console.log('Max concurrent requests for identity batch. Skipping.');
    return;
  }

  let batch = [];

  // Move entries from the buffer to the batch
  Object.keys(identityBuffer).forEach(key => {
    batch.push(Object.assign({ key }, identityBuffer[key]));
    delete identityBuffer[key];
  });

  if (batch.length === 0) {
    return;
  }

  const requestIdentities = batch.map(batchEntry => batchEntry.identity);

  const requestId = uuid();
  const start = process.hrtime();

  identityRequests[requestId] = getIdentities(requestIdentities)
    .then(responseIdentities => {
      if (batch.length !== responseIdentities.length) {
        throw new Error('Length mismatch');
      }
      // Releasing concurrent requests count
      delete identityRequests[requestId];
      // Instrumentation
      instruments.increment('hub.identities.response.success');
      instruments.hrtime('hub.identities.response.success.time', start);
      batch.forEach((batchEntry, i) => {
        const identityMap = fromJS(responseIdentities[i]);
        cache.set(batchEntry.key, identityMap);
        batchEntry.promises.forEach(({ resolve }) => {
          resolve(identityMap.size ? identityMap : null);
        });
      });
    })
    .catch(err => {
      console.error('Identity request error:', err.message);
      // Releasing concurrent requests count
      delete identityRequests[requestId];
      // Instrumentation
      instruments.increment('hub.identities.response.exception');
      instruments.hrtime('hub.identities.response.exception.time', start);
      // Resolving all the requests with an empty response
      batch.forEach(batchEntry => {
        batchEntry.promises.forEach(({ resolve }) => {
          resolve();
        });
      });
    });
}

function getIdentities(identities) {
  return client.post('/identities', { identities }).then(response => {
    if (typeof response.data !== 'object') {
      throw new TypeError('Response not an object');
    }
    if (!response.data.identities || !Array.isArray(response.data.identities)) {
      throw new TypeError('Response identities not an array');
    }
    return response.data.identities;
  });
}

let activityBuffer = Map();

const activityRequests = {};

const types = {
  '/robots.txt': 'robot',
  '/favicon.ico': 'favicon',
  '.png': 'img',
  '.gif': 'img',
  '.jpg': 'img',
  '.svg': 'svg',
  '.css': 'css',
  '.js': 'js',
};

function detectType(url) {
  let type = 'mixed';

  Object.keys(types).some(key => {
    if (url.slice(key.length * -1) === key) {
      type = types[key];
      return true;
    }
  });

  return type;
}

function activityFeedback(log) {
  const activityBufferCount = activityBuffer.size;
  if (activityBufferCount >= 100) {
    console.log(
      'Activity feedback buffer full. Skipping.',
      activityBufferCount
    );
    return;
  }

  // Get identity id
  let identityId = log.getIn(['identity', 'id']);
  if (!identityId) {
    identityId = signature.getIdentityId({
      address: log.getIn(
        ['address', 'value'],
        log.getIn(['request', 'address'])
      ),
      headers: log.getIn(['request', 'headers']).toJS(),
    });
  }

  // Get host
  let host = log.getIn(['request', 'headers', 'host']);
  if (!host) {
    return;
  }
  if (host.indexOf(':') !== -1) {
    [host] = host.split(':');
  }

  const values = [
    log.getIn(['request', 'method']).toLowerCase(),
    detectType(log.getIn(['request', 'url'])),
  ];
  values.forEach(value => {
    if (value) {
      activityBuffer = activityBuffer.updateIn(
        [identityId, host, value],
        0,
        n => n + 1
      );
    }
  });
}

function batchActivityFeedback() {
  if (activityBuffer.size === 0) {
    return;
  }

  const countCurrentRequests = Object.keys(activityRequests).length;
  if (countCurrentRequests >= config.hub.activity.maxConcurrentRequests) {
    console.log('Max concurrent requests for activity feedback. Skipping.');
    return;
  }

  const activity = activityBuffer.toJS();
  activityBuffer = activityBuffer.clear();

  const requestId = uuid();
  const start = process.hrtime();

  activityRequests[requestId] = client
    .post('/activity', { activity })
    .then(response => {
      if (typeof response.data !== 'object') {
        throw new TypeError('Response not an object');
      }
      if (
        !response.data.identities ||
        !Array.isArray(response.data.identities)
      ) {
        throw new TypeError('Response identities not an array');
      }
      // Releasing concurrent requests count
      delete activityRequests[requestId];
      // Instrumentation
      instruments.increment('hub.activity.response.success');
      instruments.hrtime('hub.activity.response.success.time', start);
      response.data.identities.forEach(identity => {
        const identityMap = fromJS(identity);
        const cachedMap = cache.get(identity.id);
        if (!is(cachedMap, identityMap)) {
          cache.set(identity.id, identityMap);
        }
      });
    })
    .catch(err => {
      console.error('Activity feedback error:', err.message);
      // Instrumentation
      instruments.increment('hub.activity.response.exception');
      instruments.hrtime('hub.activity.response.exception.time', start);
      // Releasing concurrent requests count
      delete activityRequests[requestId];
    });
}

const accessWatchSdkDatabase = database();

const getSession = ({ type, id, immutable = true, options }) => {
  if (type === 'robot') {
    return accessWatchSdkDatabase
      .getRobot({ uuid: id }, options)
      .then(robot => (immutable ? fromJS({ robot, id }) : { robot, id }));
  } else {
    return accessWatchSdkDatabase
      .getAddress(id, options)
      .then(address => (immutable ? fromJS({ address, id }) : { address, id }));
  }
};

setInterval(batchIdentityFetch, config.hub.identity.batchInterval);

setInterval(batchActivityFeedback, config.hub.activity.batchInterval);

// Instrumentation

setInterval(() => {
  instruments.gauge(`hub.cache.count`, cache.itemCount);
}, 1000);

module.exports = {
  augment,
  getSession,
};
