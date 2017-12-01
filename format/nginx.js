const { fromJS, Map, List } = require('immutable')
const strptime = require('micro-strptime').strptime

/**
 * Compile a Nginx log format into a log parser.
 *
 * Return a function that parses a line of log into an immutable Map.
 */
function compileLineParser (format) {
  const parts = format.split(/\$([A-Za-z0-9_]+)/)

  const matchString = ([head, ...tail], text) => {
    if (!text.startsWith(head)) {
      throw new Error(`Syntax error. Was expecting the string ${head}. Got: ${text}`)
    }
    if (tail.length === 0) {
      return Map()
    }
    return matchVariable(tail, text.substring(head.length))
  }

  const matchVariable = ([head, ...tail], text) => {
    const len = text.indexOf(tail[0])
    if (len === -1) {
      throw new Error(`Syntax error. Was expecting the variable ${head}. Got ${text}.`)
    }
    const value = text.substring(0, len)
    return matchString(tail, text.substring(len)).set(head, value)
  }

  return line => matchString(parts, line)
}

/**
 * Parse a HTTP request header line.
 */
function parseRequest (request) {
  const res = /([^ ]+)\s+([^ ]+)\s+([^ ]+)/.exec(request)
  if (!res) {
    return Map({})
    // throw new Error(`Could not parse request: '${request}'.`)
  }
  return Map({ method: res[1], url: res[2], protocol: res[3] })
}

/**
 * Parse a Time formatted in CLF format
 */
function parseTime (value) {
  return strptime(value, '%d/%B/%Y:%H:%M:%S %z').toISOString()
}

const transformers = {
  remote_addr: (log, value) => log.setIn(['request', 'address'], value),
  time_local: (log, value) => log.setIn(['request', 'time'], parseTime(value)),
  time_iso8601: (log, value) => log.setIn(['request', 'time'], value),
  status: (log, value) => log.setIn(['response', 'status'], parseInt(value, 10)),
  request: (log, value) => log.update('request', r => parseRequest(value).merge(r))
}

function addHeader (log, name, value) {
  log = log.updateIn(['request', 'captured_headers'], List(), list => list.push(name))
  if (value !== '-') {
    log = log.setIn(['request', 'headers', name], value)
  }
  return log
}

function reducer (log, value, key) {
  const transform = transformers[key]
  if (transform) {
    return transform(log, value)
  }
  if (key.startsWith('http_')) {
    const name = key.substring(5).replace('_', '-')
    return addHeader(log, name, value)
  }
  return log
}

function parser ({format = formats.combined} = {}) {
  const baseLog = fromJS({request: {headers: {}}})
  const lineParser = compileLineParser(format)
  return line => lineParser(line).reduce(reducer, baseLog)
}

const formats = {
  combined: '$remote_addr - $remote_user [$time_local] "$request" $status $bytes_sent "$http_referer" "$http_user_agent"',
  accessWatch: '"$time_iso8601" "$remote_addr" "$http_host" "$request" $status "$http_user_agent" "$http_accept" "$http_accept_language" "$http_accept_charset" "$http_accept_encoding" "$http_from" "$http_dnt" "$http_connection" "$http_referer"',
  accessWatchCombined: '$remote_addr - $remote_user [$time_local] "$request" $status $bytes_sent "$http_referer" "$http_user_agent" "$http_accept" "$http_accept_charset" "$http_accept_encoding" "$http_accept_language" "$http_connection" "$http_dnt" "$http_from" "$http_host"'
}

module.exports = {
  formats: formats,
  parser: parser
}
