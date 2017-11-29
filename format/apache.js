const { fromJS, Map, List } = require('immutable')
const strptime = require('micro-strptime').strptime

function compile (format) {
  const parts = format.split(/(%[^ "]+)/)

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

function addRequest (log, request) {
  const res = /([^ ]+)\s+([^ ]+)\s+([^ ]+)/.exec(request)
  if (res) {
    return log
      .setIn(['request', 'method'], res[1])
      .setIn(['request', 'url'], res[2])
      .setIn(['request', 'protocol'], res[3])
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
  '%r': addRequest,
  '%>s': (log, value) => log.setIn(['response', 'status'], parseInt(value))
}

function parser ({format}) {
  const p = compile(format)
  return (msg) => {
    return p(msg).reduce((log, v, k) => {
      const transform = transformers[k.toLowerCase()]
      if (transform) {
        return transform(log, v)
      }
      const header = k.match(/%\{([^}]+)\}i/)
      if (header) {
        const name = header[1].toLowerCase()
        log = log.updateIn(['request', 'captured_headers'], List(), coll => coll.push(name))
        if (v === '-') {
          return log
        }
        return log.setIn(['request', 'headers', name], v)
      }
      return log
    }, fromJS({request: {headers: {}}}))
  }
}

const formats = {
  combined: '%h %l %u %t "%r" %>s %b "%{Referer}i" "%{User-agent}i"',
  accessWatch: '%h %l %u %t "%r" %>s %b "%{Referer}i" "%{User-agent}i" "%{Accept}i" "%{Accept-Charset}i" "%{Accept-Encoding}i" "%{Accept-Language}i" "%{Connection}i" "%{Dnt}i" "%{From}i" "%{Host}i"'
}

module.exports = {
  formats: formats,
  parser: parser
}
