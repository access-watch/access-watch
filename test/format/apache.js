/* eslint-env mocha */

const assert = require('assert');

const apache = require('../../src/format/apache.js');

const cases = [
  {
    name: 'should parse a log according to the combined format',
    options: {
      format: '%h %l %u %t "%r" %>s %b "%{Referer}i" "%{User-agent}i"',
    },
    msg:
      '127.0.0.1 - - [27/Jan/2016:11:43:30 -0600] "GET /js/out/goog/asserts/asserts.js HTTP/1.1" 200 3480 "http://localhost:8080/" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36"',
    expected: {
      request: {
        address: '127.0.0.1',
        time: '2016-01-27T17:43:30.000Z',
        method: 'GET',
        url: '/js/out/goog/asserts/asserts.js',
        protocol: 'HTTP/1.1',
        captured_headers: ['referer', 'user-agent'],
        headers: {
          referer: 'http://localhost:8080/',
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36',
        },
      },
      response: {
        status: 200,
      },
    },
  },
  {
    name: 'should parse a log according to the Access Watch format',
    options: {
      format:
        '%h %l %u %t "%r" %>s %b "%{Referer}i" "%{User-agent}i" "%{Accept}i" "%{Accept-Charset}i" "%{Accept-Encoding}i" "%{Accept-Language}i" "%{Connection}i" "%{Dnt}i" "%{From}i" "%{Host}i"',
    },
    msg:
      '127.0.0.1 - - [27/Jan/2016:11:43:30 -0600] "GET / HTTP/1.1" 304 3480 "http://localhost:8080/" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36" "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8" "en-US,en;q=0.8,fil;q=0.6,fr;q=0.4,es;q=0.2" "-" "gzip, deflate, br" "-" "-" "keep-alive" "-"',
    expected: {
      request: {
        address: '127.0.0.1',
        captured_headers: [
          'dnt',
          'connection',
          'referer',
          'user-agent',
          'accept-charset',
          'accept',
          'host',
          'from',
          'accept-encoding',
          'accept-language',
        ],
        headers: {
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'accept-charset': 'en-US,en;q=0.8,fil;q=0.6,fr;q=0.4,es;q=0.2',
          'accept-language': 'gzip, deflate, br',
          from: 'keep-alive',
          referer: 'http://localhost:8080/',
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36',
        },
        method: 'GET',
        protocol: 'HTTP/1.1',
        time: '2016-01-27T17:43:30.000Z',
        url: '/',
      },
      response: {
        status: 304,
      },
    },
  },
];

describe('Apache format', function() {
  cases.map(({ name, options, msg, expected }) => {
    it(name, function() {
      const parse = apache.parser(options);
      assert.deepEqual(parse(msg).toJS(), expected);
    });
  });
});
