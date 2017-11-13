/**
 * Reducers for the pipeline's window functions.
 *
 * Reducers must be stateless.
 */

const { Map } = require('immutable')
const { selectKeys } = require('./util.js')

/**
 * Wrap a reducer that works on a metric's value.
 */
function metric (reducer) {
  return {
    init: () => {
      return Map({value: reducer.init()})
    },
    step: (res, event) => {
      return res
        .update('value', acc => reducer.step(acc, event.get('value')))
        .merge(selectKeys(event, ['name', 'tags']))
    },
    result: (res) => {
      return res.update('value', acc => reducer.result(acc))
    },
    merge: (res1, res2) => {
      return res1.update('value', acc => reducer.merge(acc, res2.get('value')))
    }
  }
}

/**
 * Count events.
 */
function count () {
  return metric({
    init: () => {
      return 0
    },
    step: (result, val) => {
      return result + 1
    },
    result: (res) => {
      return res
    },
    merge: (res1, res2) => {
      return res1 + res2
    }
  })
}

module.exports = {
  count: count
}
