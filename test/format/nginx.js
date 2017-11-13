/* eslint-env mocha */

const assert = require('assert')
const nginx = require('../../format/nginx.js')

const cases = [

  {
    name: 'should parse a log according to the standard format',
    options: {},
    msg: '127.0.0.1 - - [27/Jan/2016:11:43:30 -0600] "GET /js/out/goog/asserts/asserts.js HTTP/1.1" 200 3480 "http://localhost:8080/" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36" "-"',
    expected: {
      request: {
        method: 'GET',
        url: '/js/out/goog/asserts/asserts.js',
        protocol: 'HTTP/1.1',
        captured_headers: ['user-agent', 'referer'],
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36',
          referer: 'http://localhost:8080/'
        },
        time: '2016-01-27T17:43:30.000Z',
        address: '127.0.0.1'
      },
      response: {
        status: 200
      }
    }
  },

  {
    name: 'should parse a log according to a custom format',
    options: {
      format: nginx.formats.accessWatch
    },
    msg: '"2017-10-27T10:06:42-05:00" "127.0.0.1" "localhost:8080" "GET / HTTP/1.1" 304 "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36" "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8" "en-US,en;q=0.8,fil;q=0.6,fr;q=0.4,es;q=0.2" "-" "gzip, deflate, br" "-" "-" "keep-alive" "-"',
    expected: {
      request: {
        method: 'GET',
        url: '/',
        protocol: 'HTTP/1.1',
        captured_headers: [
          'from', 'user-agent', 'accept-charset', 'accept-encoding', 'dnt',
          'connection', 'referer', 'accept-language', 'accept', 'host'
        ],
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36',
          'accept-encoding': 'gzip, deflate, br',
          connection: 'keep-alive',
          'accept-language': 'en-US,en;q=0.8,fil;q=0.6,fr;q=0.4,es;q=0.2',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          host: 'localhost:8080'
        },
        address: '127.0.0.1',
        time: '2017-10-27T10:06:42-05:00'
      },
      response: {
        status: 304
      }
    }
  },

  {
    name: 'fixes bug #62',
    options: {
      format: '"$time_iso8601" "$remote_addr" "$http_host" "$request" $status "$http_user_agent" "$http_accept" "$http_accept_language" "$http_accept_charset" "$http_accept_encoding" "$http_from" "$http_dnt" "$http_connection" "$http_referer"'
    },
    msg: '"2017-11-06T14:06:48+01:00" "90.113.143.180" "-" "-" 400 "-" "-" "-" "-" "-" "-" "-" "-" "-"',
    expected: {
      request: {
        captured_headers: [
          'from', 'user-agent', 'accept-charset', 'accept-encoding', 'dnt',
          'connection', 'referer', 'accept-language', 'accept', 'host'
        ],
        headers: {
        },
        address: '90.113.143.180',
        time: '2017-11-06T14:06:48+01:00'
      },
      response: {
        status: 400
      }
    }
  }
]

describe('Nginx format', function () {
  cases.map(({name, options, msg, expected}) => {
    it(name, function () {
      const parse = nginx.parser(options)
      assert.deepEqual(parse(msg).toJS(), expected)
    })
  })
})
