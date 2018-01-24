/* eslint-env mocha */

const memoryLogsProvider = require('../../src/plugins/memory-logs');
const assert = require('assert');
const { fromJS } = require('immutable');
const { memoryIndexFactory } = memoryLogsProvider;

describe('memoryIndex', () => {
  it('can index element', () => {
    const memoryIndex = memoryIndexFactory(5);
    memoryIndex.push(1, 'test');
    assert(memoryIndex.get(1)[0] === 'test');
    assert(Object.keys(memoryIndex.collection).length === 1);
    memoryIndex.push(2, 'test2');
    assert(Object.keys(memoryIndex.collection).length === 2);
  });
  it('can give a list of all indexes', () => {
    const memoryIndex = memoryIndexFactory(5);
    memoryIndex.push(1, 'test');
    memoryIndex.push(2, 'test');
    assert.deepEqual(Object.keys(memoryIndex.collection), [1, 2]);
  });
  it('is a FIFO collection with a limit', () => {
    const memoryIndex = memoryIndexFactory(2);
    memoryIndex.push(1, 'test');
    memoryIndex.push(1, 'test2');
    assert(memoryIndex.get(1)[1] === 'test');
    memoryIndex.push(1, 'test3');
    assert(memoryIndex.get(1)[1] === 'test2');
    memoryIndex.push(2, 'test4');
    assert(memoryIndex.get(1).length === 1);
  });
});

const fakeLogs = [
  {
    request: {
      time: '2018-01-19T13:20:03.450Z',
    },
    address: {
      value: '1',
    },
    identity: {
      id: '1',
    },
  },
  {
    request: {
      time: '2018-01-19T13:30:00Z',
    },
    address: {
      value: '1',
    },
    identity: {
      id: '1',
    },
  },
  {
    request: {
      time: '2018-01-19T13:40:03.000Z',
    },
    address: {
      value: '2',
    },
    identity: {
      id: '2',
    },
  },
  {
    request: {
      time: '2018-01-19T13:50:03.000Z',
    },
    address: {
      value: '3',
    },
    identity: {
      id: '3',
    },
  },
];

const immutableFakeLogs = fakeLogs.map(log => fromJS(log));
const reverseFakeLogs = fakeLogs.slice().reverse();

describe('memoryLogsProvider', () => {
  it('can index and retrieve logs', () => {
    immutableFakeLogs.forEach(memoryLogsProvider.index);
    return memoryLogsProvider.searchLogs().then(search => {
      assert(search.length === 4);
      assert.deepEqual(reverseFakeLogs, search);
    });
  });
  it('can search for logs with start', () => {
    const start = Math.floor(
      new Date(fakeLogs[1].request.time).getTime() / 1000
    );
    return memoryLogsProvider
      .searchLogs({
        start,
      })
      .then(search => {
        assert.deepEqual(reverseFakeLogs.slice(0, fakeLogs.length - 1), search);
      });
  });
  it('can search for logs in a specific time period', () => {
    const start = Math.floor(
      new Date(fakeLogs[1].request.time).getTime() / 1000
    );
    return memoryLogsProvider
      .searchLogs({
        start,
        end:
          Math.floor(new Date(fakeLogs[2].request.time).getTime() / 1000) - 1,
      })
      .then(search => {
        assert.deepEqual(search[0], fakeLogs[1]);
        assert(search.length === 1);
      });
  });
  it('can search for only a subset of logs with limit', () =>
    memoryLogsProvider.searchLogs({ limit: 1 }).then(search => {
      assert(search.length === 1);
    }));

  it('can handle special params', () => {
    const search = memoryLogsProvider
      .searchLogs({ 'address.value': '1' })
      .then(res => {
        assert(res.length === 2);
        assert(res.every(log => log.address.value === '1'));
      });
    const search2 = memoryLogsProvider
      .searchLogs({ 'address.value': '2' })
      .then(res2 => {
        assert(res2.length === 1);
        assert(res2.every(log => log.address.value === '2'));
      });
    return Promise.all([search, search2]);
  });

  it('can handle special params with or', () =>
    memoryLogsProvider.searchLogs({ 'address.value': '1,2' }).then(res => {
      assert(res.length === 3);
      assert(
        res.every(log => log.address.value === '1' || log.address.value === '2')
      );
    }));

  it('does not index not augmented log', () =>
    memoryLogsProvider.searchLogs().then(res => {
      const originalLength = res.length;
      memoryLogsProvider.index(immutableFakeLogs[0].delete('identity'));
      return memoryLogsProvider.searchLogs().then(newRes => {
        assert(newRes.length === originalLength);
      });
    }));
});
