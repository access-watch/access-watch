/**
 * Window strategies to use with the window stream processor.
 */
const { fromJS, Map, Range, List } = require('immutable')

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

function intersect (a, b) {
  return a.get('end') > b.get('start') && a.get('start') < b.get('end')
}

function merge (a, b) {
  return Map({
    start: Math.min(a.get('start'), b.get('start')),
    end: Math.max(a.get('end'), b.get('end'))
  })
}

/**
 * Assign events to sessions separated by a gap period.
 */
class SessionWindow {
  constructor (gap) {
    this.gap = gap
  }
  assign (event) {
    const t = event.get('time')
    return fromJS([{start: t, end: t + this.gap}])
  }
  merge (windows, f) {
    let merges = []
    let candidate
    windows
      .sort((a, b) => a.get('start') - b.get('start'))
      .forEach(window => {
        if (!candidate) {
          candidate = window
        } else {
          if (intersect(candidate, window)) {
            candidate = f(candidate, window).merge(merge(candidate, window))
          } else {
            merges.push(candidate)
            candidate = window
          }
        }
      })
    merges.push(candidate)
    return List(merges)
  }
}

module.exports = {
  FixedWindow: FixedWindow,
  SlidingWindow: SlidingWindow,
  SessionWindow: SessionWindow
}
