/* eslint-env mocha */

const assert = require('assert');
const { fromJS } = require('immutable');

const metrics = require('../../src/lib/metrics.js');
const database = require('../../src/lib/database.js');

describe('Metrics', function() {
  let db;

  before(function() {
    db = metrics.connect({ protocol: 'memory' });
    const metric = fromJS({
      name: 'request',
      time: 11,
      value: 2,
      tags: {
        status: 'nice',
      },
    });
    db.add(metric);
    db.add(metric.setIn(['tags', 'status'], 'bad'));
    db.add(metric.set('time', 12).set('value', 3));
    db.add(metric.set('time', 13).setIn(['tags', 'status'], 'bad'));
    db.add(metric.set('time', 16));
  });

  after(function() {
    database.close();
  });

  it('index by name', function() {
    assert.deepStrictEqual(db.query(fromJS({ name: 'request' })), [
      [11, 4],
      [12, 3],
      [13, 2],
      [14, 0],
      [15, 0],
      [16, 2],
    ]);
  });

  it('index by name and tags', function() {
    assert.deepStrictEqual(
      db.query(fromJS({ name: 'request', tags: { status: 'nice' } })),
      [[11, 2], [12, 3], [13, 0], [14, 0], [15, 0], [16, 2]]
    );
  });

  it('index by name and time', function() {
    assert.deepStrictEqual(
      db.query(fromJS({ name: 'request', start: 11, end: 12 })),
      [[11, 4]]
    );
  });

  it('index by name, time and tags', function() {
    assert.deepStrictEqual(
      db.query(
        fromJS({
          name: 'request',
          start: 11,
          end: 12,
          tags: { status: 'nice' },
        })
      ),
      [[11, 2]]
    );
  });

  it('group by tag', function() {
    assert.deepStrictEqual(
      db.query(fromJS({ name: 'request', by: 'status' })),
      [
        [11, { nice: 2, bad: 2 }],
        [12, { nice: 3 }],
        [13, { bad: 2 }],
        [14, {}],
        [15, {}],
        [16, { nice: 2 }],
      ]
    );
  });

  it('index by name, time, and tags and groups by tag', function() {
    let query = fromJS({
      name: 'request',
      tags: {
        status: 'nice',
      },
      start: 11,
      end: 12,
      by: 'status',
    });
    assert.deepStrictEqual(db.query(query), [[11, { nice: 2 }]]);
  });

  it('groups by time periods and fills holes with zeroes', function() {
    assert.deepStrictEqual(db.query(fromJS({ name: 'request', step: 2 })), [
      [10, 4],
      [12, 5],
      [14, 0],
      [16, 2],
    ]);
  });

  it('Fix #45', function() {
    assert.deepStrictEqual(db.query(fromJS({ name: 'request' })), [
      [11, 4],
      [12, 3],
      [13, 2],
      [14, 0],
      [15, 0],
      [16, 2],
    ]);
  });

  it('Fix #51', function() {
    assert.deepStrictEqual(
      db.query(fromJS({ name: 'request', start: 12, end: 18, step: 5 })),
      [[10, 5], [15, 2]]
    );
  });
});
