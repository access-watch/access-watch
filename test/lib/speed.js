/* eslint-env mocha */

const assert = require('assert');

const { Speed } = require('../../src/lib/speed');
const { now } = require('../../src/lib/util');

describe('Speed', function() {
  it('count hits per fixed time windows', function() {
    const windowSize = 10;
    const size = 5;
    const s = new Speed(windowSize, size);
    const t = now();
    s.hit(t - 3 * windowSize);
    s.hit(t - 3 * windowSize);
    s.hit(t - 1 * windowSize);
    assert.deepStrictEqual(s.compute().toJS(), [0, 1, 0, 2]);
  });

  it('garbage collects old hits', function() {
    const windowSize = 10;
    const size = 5;
    const s = new Speed(windowSize, size);
    const t = now();
    s.hit(t - 7 * windowSize);
    s.hit(t - 6 * windowSize);
    s.hit(t - 5 * windowSize);
    s.hit(t - 3 * windowSize);
    s.hit(t - 3 * windowSize);
    s.hit(t - 1 * windowSize);
    assert.deepStrictEqual(s.compute().toJS(), [0, 1, 0, 2, 0]);
  });

  it('serialize/deserialize', function() {
    const windowSize = 10;
    const size = 5;
    const s = new Speed(windowSize, size);
    const t = now();
    s.hit(t - 7 * windowSize);
    s.hit(t - 6 * windowSize);
    s.hit(t - 5 * windowSize);
    s.hit(t - 3 * windowSize);
    s.hit(t - 3 * windowSize);
    s.hit(t - 1 * windowSize);
    const ss = Speed.deserialize(s.serialize());
    assert.deepStrictEqual(ss.compute().toJS(), [0, 1, 0, 2, 0]);
  });
});
