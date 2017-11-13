/* eslint-env mocha */

const assert = require('assert')
const { fromJS, Map } = require('immutable')
const metrics = require('../../lib/metrics.js')

function assertMapEqual (m1, m2) {
  assert.deepEqual(m1.toJS(), m2.toJS())
}

describe('Database', function () {
  let db

  before(function () {
    db = metrics.createDatabase('test')
    const metric = fromJS({
      name: 'request',
      time: 11,
      value: 2,
      tags: {
        'status': 'nice'
      }
    })
    db.add(metric)
    db.add(metric.setIn(['tags', 'status'], 'bad'))
    db.add(metric.set('time', 12).set('value', 3))
    db.add(metric.set('time', 13).setIn(['tags', 'status'], 'bad'))
    db.add(metric.set('time', 16))
  })

  after(function () {
    db.close()
  })

  it('index by name', function () {
    assertMapEqual(Map({11: 4, 12: 3, 13: 2, 16: 2}),
                   db.query(fromJS({name: 'request'})))
  })

  it('index by name and tags', function () {
    assertMapEqual(Map({11: 2, 12: 3, 16: 2}),
                   db.query(fromJS({name: 'request', tags: {status: 'nice'}})))
  })

  it('index by name and time', function () {
    assertMapEqual(Map({11: 4}),
                   db.query(fromJS({name: 'request', start: 11, end: 12})))
  })

  it('index by name, time and tags', function () {
    assertMapEqual(Map({11: 2}),
                   db.query(fromJS({name: 'request', start: 11, end: 12, tags: {status: 'nice'}})))
  })

  it('group by tag', function () {
    assertMapEqual(Map({11: {nice: 2, bad: 2}, 12: {nice: 3}, 13: {bad: 2}, 16: {nice: 2}}),
                   db.query(fromJS({name: 'request', by: 'status'})))
  })

  it('index by name, time, and tags and groups by tag', function () {
    let query = fromJS({
      name: 'request',
      tags: {
        status: 'nice'
      },
      start: 11,
      end: 12,
      by: 'status'
    })
    assertMapEqual(Map({11: {nice: 2}}), db.query(query))
  })

  it('groups by time periods and fills holes with zeroes', function () {
    assertMapEqual(Map({10: 4, 12: 5, 14: 0, 16: 2}), db.query(fromJS({name: 'request', step: 2})))
  })
})
