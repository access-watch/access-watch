/**
 * Window strategies to use with the window stream processor.
 */
const { fromJS, Map, Range } = require('immutable')

/**
 * Assign events to a fixed interval.
 */
class FixedWindow {
  constructor (size, offset = 0) {
    this.size = size
    this.offset = offset % size
  }
  assign (event) {
    const t = event.get('time')
    const start = t - (t - this.offset) % this.size
    return fromJS([{
      start: start,
      end: start + this.size
    }])
  }
  merge (windows) {
    return windows
  }
}

/**
 * Assign events to a set of sliding windows.
 */
class SlidingWindow {
  constructor (size, period, offset = 0) {
    this.size = size
    this.period = period
    this.offset = offset % size
  }
  assign (event) {
    const t = event.get('time')
    const start = t - (t - this.offset) % this.period
    return Range(start, start - this.size, this.period)
      .map(t => Map({start: t, end: t + this.size}))
      .reverse()
  }
  merge (windows) {
    return windows
  }
}

module.exports = {
  FixedWindow: FixedWindow,
  SlidingWindow: SlidingWindow
}
