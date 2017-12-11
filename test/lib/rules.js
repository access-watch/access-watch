/* eslint-env mocha */

const assert = require('assert')
const fs = require('fs')
const { fromJS } = require('immutable')
const rules = require('../../lib/rules.js')

const path = './test-rules.json'

describe('Rules', function () {
  it('works', function () {
    const db = rules.createDatabase('test', {path: path})
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

    const log = fromJS({
      address: {
        value: '127.0.0.2'
      }
    })

    db.match(log)

    assert.equal(db.get('1').get('count'), 0)
    assert.equal(db.get('2').get('count'), 1)

    db.close()

    const newDb = rules.createDatabase('test2', {path: path})
    newDb.match(log)

    assert.equal(newDb.get('1').get('count'), 0)
    assert.equal(newDb.get('2').get('count'), 2)

    newDb.close()
    fs.unlinkSync(path)
  })
})
