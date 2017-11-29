const { fromJS, Map, List } = require('immutable')
const strptime = require('micro-strptime').strptime
const { fnull } = require('../lib/util.js')

/**
 * Compile a Nginx log format into a log parser.
 *
 * Return a function that parses a line of log into an immutable Map.
 */
function compile (format) {
  const parts = format.split(/\$([A-Za-z0-9_]+)/)

  const matchString = ([head, ...tail], text) => {
    if (text.startsWith(head)) {
      if (tail.length === 0) {
        return Map()
      }
      return matchVariable(tail, text.substring(head.length))
    } else {
      throw new Error(`Syntax error. Was expecting the string ${head}. Got: ${text}`)
    }
  }

  const matchVariable = ([head, ...tail], text) => {
    const len = text.indexOf(tail[0])
    if (len !== -1) {
      const value = text.substring(0, len)
      return matchString(tail, text.substring(len)).set(head, value)
    } else {
      throw new Error(`Syntax error. Was expecting the variable ${head}. Got ${text}.`)
    }
  }

  return s => {
    return matchString(parts, s)
  }
}

/**
 * Parse a HTTP request header line.
 */
function parseRequest (request) {
  const res = /([^ ]+)\s+([^ ]+)\s+([^ ]+)/.exec(request)
  if (res) {
    return Map({
      method: res[1],
      url: res[2],
      protocol: res[3]
    })
  } else {
    return Map()
  }
}

/**
 * Transform a log line following `format` into a log map.
 *
 * `timeFormat` can be specified to parse the `time_local` variable.
 */
function parser ({format = formats.combined,
                  timeFormat = '%d/%B/%Y:%H:%M:%S %z'} = {}) {
  const parse = compile(format)

  const transformers = {
    remote_addr: (log, value) => log.setIn(['request', 'address'], value),
    time_local: (log, value) => log.setIn(['request', 'time'], strptime(value, timeFormat).toISOString()),
    time_iso8601: (log, value) => log.setIn(['request', 'time'], value),
    status: (log, value) => log.setIn(['response', 'status'], parseInt(value)),
    request: (log, value) => log.update('request', r => parseRequest(value).merge(r))
  }

  return (msg) => {
    let m
    try {
      m = parse(msg)
    } catch (error) {
      throw new Error('Cannot parse message: [' + msg + ']. ' + error.message)
    }
    return m.reduce((log, v, k) => {
      const transform = transformers[k]
      if (transform) {
        return transform(log, v)
      } else if (k.startsWith('http_')) {
        const name = k.substring(5).replace('_', '-')
        log = log.updateIn(['request', 'captured_headers'],
                           fnull(l => l.push(name), List()))
        if (v === undefined || v === '-') {
          return log
        } else {
          return log.setIn(['request', 'headers', name], v)
        }
      }
      return log
    }, fromJS({request: {headers: {}}}))
  }
}

const formats = {
  combined: '$remote_addr - $remote_user [$time_local] "$request" $status $bytes_sent "$http_referer" "$http_user_agent"',
  accessWatch: '"$time_iso8601" "$remote_addr" "$http_host" "$request" $status "$http_user_agent" "$http_accept" "$http_accept_language" "$http_accept_charset" "$http_accept_encoding" "$http_from" "$http_dnt" "$http_connection" "$http_referer"'
}

module.exports = {
  formats: formats,
  parser: parser
}
