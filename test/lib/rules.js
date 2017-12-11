/* eslint-env mocha */

const assert = require('assert')
const { fromJS } = require('immutable')
const rules = require('../../lib/rules.js')

describe('Rules', function () {
  let db

  before(function () {
    db = rules.connect('aw:mem://rules')
  })

  it('works', function () {
    const rule1 = fromJS({
      id: '1',
      conditions: [
        {
          type: 'address',
          address: '127.0.0.1'
        }
      ]
    })
    db.add(rule1)

    const rule2 = fromJS({
      id: '2',
      conditions: [
        {
          type: 'address',
          address: '127.0.0.2'
        }
      ]
    })
    db.add(rule2)

    const badRules = fromJS(
      [
        {conditions: []},
        {conditions: [{ type: 'address' }]},
        {conditions: [{ type: 'address', address: 1 }]},
        {conditions: [{ type: 'address', address: '127.0.0.1' }, { type: 'address' }]}
      ])

    badRules.forEach(r => {
      assert.throws(() => {
        db.add(r)
      }, Error)
    })

    const log = fromJS({
      address: {
        value: '127.0.0.2'
      }
    })

    db.match(log)

    assert.equal(db.get('1').get('count'), 0)
    assert.equal(db.get('2').get('count'), 1)
  })
})
