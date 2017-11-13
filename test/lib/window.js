/* eslint-env mocha */

const assert = require('assert')
const { Map } = require('immutable')
const { FixedWindow, SlidingWindow, SessionWindow } = require('../../lib/window.js')

function assertWindows (expected, actual) {
  assert.deepEqual(expected, actual.toJS())
}

describe('FixedWindow', function () {
  it('assign events to a fixed interval window.', function () {
    assertWindows([{start: 0, end: 10}],
                  new FixedWindow(10).assign(Map({time: 0})))
    assertWindows([{start: 0, end: 10}],
                  new FixedWindow(10).assign(Map({time: 9})))
    assertWindows([{start: 10, end: 20}],
                  new FixedWindow(10).assign(Map({time: 10})))
    assertWindows([{start: 5, end: 15}],
                  new FixedWindow(10, 5).assign(Map({time: 0})))
    assertWindows([{start: 15, end: 25}],
                  new FixedWindow(10, 5).assign(Map({time: 15})))
  })
})

describe('SlidingWindow', function () {
  it('assign events to sliding windows.', function () {
    assertWindows([{start: 0, end: 10}, {start: 5, end: 15}],
                  new SlidingWindow(10, 5).assign(Map({time: 7})))
    assertWindows([{start: 0, end: 10}],
                  new SlidingWindow(10, 10).assign(Map({time: 7})))
    assertWindows([{start: 10, end: 20}, {start: 15, end: 25}],
                  new SlidingWindow(10, 5).assign(Map({time: 18})))
  })
})

describe('SessionWindow', function () {
  it('assign events to a session.', function () {
    assertWindows([{start: 2, end: 32}],
                  new SessionWindow(30).assign(Map({time: 2})))
  })

  it('merge sessions.', function () {
    const strategy = new SessionWindow(30)
    assertWindows([{start: 2, end: 35}],
                  strategy.merge([
                    Map({start: 2, end: 32}),
                    Map({start: 5, end: 35})
                  ], () => Map()))
  })

  it('does not merge sessions.', function () {
    const strategy = new SessionWindow(30)
    assertWindows([{start: 2, end: 32}, {start: 35, end: 65}],
                  strategy.merge([
                    Map({start: 2, end: 32}),
                    Map({start: 35, end: 65})
                  ], () => Map()))
  })
})
