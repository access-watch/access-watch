require('date-format-lite');

const LRU = require('lru-cache');
const assert = require('assert');

const { fromJS } = require('immutable');

// Number of seconds since Unix epoch
exports.now = () => Math.floor(new Date().getTime() / 1000);

// Replace the first argument of f by the value if undefined.
// WARNING: The initial value will be shared across calls so do not use a mutable object (see immutable)
exports.fnull = (f, value) => {
  return function() {
    let args = Array.prototype.slice.call(arguments);
    if (args[0] === undefined) {
      args[0] = value;
    }
    return f.apply(null, args);
  };
};

// Whether a is equal to b (deep equality)
exports.equals = (a, b) => {
  try {
    assert.deepEqual(a, b);
    return true;
  } catch (e) {
    return false;
  }
};

// Loading cache
exports.loadingCache = ({ size, maxAge, load, onError }) => {
  const lru = LRU({ size: size, maxAge: maxAge });
  return key => {
    let cacheKey = key;
    if (typeof key === 'object') {
      if (!key.cacheKey) {
        throw new Error(
          'If the key is an object, Set the `cacheKey` property on it.'
        );
      } else {
        cacheKey = key.cacheKey;
        delete key.cacheKey;
      }
    }
    if (lru.has(cacheKey)) {
      return lru.get(cacheKey);
    }
    load(key)
      .then(value => {
        lru.set(cacheKey, value);
      })
      .catch(error => {
        onError(error);
      });
  };
};

/**
 * Return the complement of the predicate `pred`.
 *
 * If pred(x) returns trues, complement(pred)(x) return false.
 */
exports.complement = f => {
  return function() {
    return !f.apply(null, Array.prototype.slice.call(arguments));
  };
};

/**
 * An immutable map with a subset of the keys.
 */
exports.selectKeys = (m, keys) => {
  return m.filter((v, k) => keys.includes(k));
};

/**
 * Compose a variable number of functions.
 */
const comp = (exports.comp = (...args) => {
  if (args.length === 2) {
    return function(...inArgs) {
      return args[0](args[1].apply(null, inArgs));
    };
  }
  if (args.length > 2) {
    return args.slice(1).reduce((f1, f2) => comp(f1, f2), args[0]);
  }
});

/**
 * Convert a timestamp into an ISO date string.
 */
exports.iso = time => new Date(time * 1000).format('iso');

exports.fromJS = o => fromJS(o);

exports.defaultParse = s => fromJS(JSON.parse(s));
