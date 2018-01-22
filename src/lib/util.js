require('date-format-lite');

const { fromJS } = require('immutable');

// Number of seconds since Unix epoch
exports.now = () => Math.floor(new Date().getTime() / 1000);

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
 * Convert a timestamp into an ISO date string.
 */
exports.iso = time => new Date(time * 1000).format('iso');

/**
 * Create a log from Express req/res
 */
exports.createLog = (req, res) => {
  return fromJS({
    request: {
      time: new Date().toISOString(),
      address: req.ip,
      method: req.method,
      url: req.originalUrl || req.url,
      headers: req.headers,
    },
    response: {
      status: res.statusCode,
    },
  });
};

const mapIncludesObject = (map, obj) =>
  Object.keys(obj).reduce((bool, key) => {
    if (!map.has(key)) {
      return false;
    }
    const mapValue = map.get(key);
    const objectValue = obj[key];
    const areSameType = typeof mapValue !== typeof objectValue;
    if (areSameType) {
      return false;
    }
    if (Array.isArray(objectValue)) {
      return bool && fromJS(objectValue).equals(mapValue);
    }
    if (typeof objectValue === 'object') {
      return bool && mapIncludesObject(mapValue, objectValue);
    }
    return bool && mapValue === objectValue;
  }, true);

exports.mapIncludesObject = mapIncludesObject;
