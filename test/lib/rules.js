/* eslint-env mocha */

const assert = require('assert')
const { fromJS } = require('immutable')
const rules = require('../../lib/rules')
const database = require('../../lib/database')
const { now, iso } = require('../../lib/util')

describe('Rules', function () {
  let db

  before(function () {
    db = rules.connect('aw:mem://rules')
  })

  after(function () {
    database.close()
  })

  it('validate rules at creation time', function () {
    const badRules = fromJS(
      [
        {},
        {condition: { type: 'address' }},
        {condition: { type: 'address', address: 1 }}
      ])

    badRules.forEach(r => {
      assert.throws(() => {
        db.add(r)
      }, Error)
    })
  })

  it('block an IP address', function () {
    const rule1 = fromJS({
      id: '1',
      condition: {
        type: 'address',
        address: {value: '127.0.0.1'}
      }
    })
    db.add(rule1)

    const rule2 = fromJS({
      id: '2',
      condition: {
        type: 'address',
        address: {value: '127.0.0.2'}
      }
    })
    db.add(rule2)

    const log = fromJS({
      time: iso(now()),
      response: {
        status: 200
      },
      address: {
        value: '127.0.0.2'
      }
    })

    db.match(log)                                      // request didn't get blocked
    db.match(log.setIn(['response', 'status'], 403))   // request did get blocked

    assert.deepEqual(db.get('1').getIn(['passed', 'per_minute']).toJS(), [])
    assert.deepEqual(db.get('1').getIn(['blocked', 'per_minute']).toJS(), [])

    assert.deepEqual(db.get('2').getIn(['passed', 'per_minute']).toJS(), [1])
    assert.deepEqual(db.get('2').getIn(['blocked', 'per_minute']).toJS(), [1])
  })
})
