const { fromJS, Map, List } = require('immutable')
const strptime = require('micro-strptime').strptime

/**
 * Compile an Apache log format into a log parser.
 *
 * Return a function that parses a line of log into an immutable Map.
 */
function compileLineParser (format) {
  const parts = format.split(/(%[^ "]+)/)

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

function parseRequest (request) {
  const res = /([^ ]+)\s+([^ ]+)\s+([^ ]+)/.exec(request)
  if (!res) {
    throw new Error(`Could not parse request: '${request}'.`)
  }
  return Map({ method: res[1], url: res[2], protocol: res[3] })
}

function addHeader (log, name, value) {
  name = name.toLowerCase()
  log = log.updateIn(['request', 'captured_headers'], List(), list => list.push(name))
  if (value !== '-') {
    log = log.setIn(['request', 'headers', name], value)
  }
  return log
}

function parseTime (value) {
  value = value.substring(1, value.length - 1) // remove '[' and ']'
  return strptime(value, '%d/%B/%Y:%H:%M:%S %z').toISOString()
}

const transformers = {
  '%h': (log, value) => log.setIn(['request', 'address'], value),
  '%t': (log, value) => log.setIn(['request', 'time'], parseTime(value)),
  '%>s': (log, value) => log.setIn(['response', 'status'], parseInt(value, 10)),
  '%r': (log, value) => log.update('request', request => parseRequest(value).merge(request))
}

function reducer (log, value, key) {
  const transform = transformers[key]
  if (transform) {
    return transform(log, value)
  }
  const header = key.match(/%\{([^}]+)\}i/)
  if (header) {
    return addHeader(log, header[1], value)
  }
  return log
}

function parser ({format}) {
  const baseLog = fromJS({request: {headers: {}}})
  const lineParser = compileLineParser(format)
  return line => lineParser(line).reduce(reducer, baseLog)
}

const formats = {
  combined: '%h %l %u %t "%r" %>s %b "%{Referer}i" "%{User-agent}i"',
  accessWatchCombined: '%h %l %u %t "%r" %>s %b "%{Referer}i" "%{User-agent}i" "%{Accept}i" "%{Accept-Charset}i" "%{Accept-Encoding}i" "%{Accept-Language}i" "%{Connection}i" "%{Dnt}i" "%{From}i" "%{Host}i"'
}

module.exports = {
  formats: formats,
  parser: parser
}
