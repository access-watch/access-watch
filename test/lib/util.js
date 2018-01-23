/* eslint-env mocha */

const { mapIncludesObject } = require('../../src/lib/util');
const { fromJS } = require('immutable');
const assert = require('assert');
describe('mapIncludesObject', () => {
  const basicMap = fromJS({
    foo: 'bar',
    baz: 'bar2',
  });
  it('handles basic map/object', () => {
    assert(mapIncludesObject(basicMap, { foo: 'bar' }));
    assert(mapIncludesObject(basicMap, { baz: 'bar2' }));
  });

  it('handles not matching', () => {
    assert(!mapIncludesObject(basicMap, { baz: 'bar' }));
    assert(!mapIncludesObject(basicMap, { toto: 'test' }));
  });

  it('handles case were map IS the object', () => {
    assert(mapIncludesObject(basicMap, { foo: 'bar', baz: 'bar2' }));
  });

  it('handles all type of data', () => {
    const map = fromJS({
      bar: 5,
      baz: false,
      arr: [1, 2],
    });
    assert(mapIncludesObject(map, { bar: 5 }));
    assert(mapIncludesObject(map, { baz: false }));
    assert(mapIncludesObject(map, { arr: [1, 2] }));
  });

  it('handles recursive structure', () => {
    const recObj = {
      foo: {
        bar: {
          baz: 5,
          other: 10,
        },
      },
    };
    const map = fromJS(recObj);
    assert(mapIncludesObject(map, { foo: { bar: { baz: 5 } } }));
  });

  it('handles array of objects', () => {
    const obj = {
      arr: [{ id: 5 }, { id: 2 }],
    };
    const map = fromJS(obj);
    assert(mapIncludesObject(map, obj));
  });
});
