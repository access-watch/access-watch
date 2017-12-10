const syslogParse = require('syslog-parse')

const { fromJS } = require('immutable')

const socket = require('./socket')

const defaultParse = s => fromJS(JSON.parse(s))

function create ({name = 'Syslog', protocol, port = 514, parse = defaultParse}) {
  return {
    name: name,
    start: pipeline => {
      const handler = message => {
        try {
          const result = syslogParse(message)
          pipeline.success(parse(result.message))
        } catch (err) {
          pipeline.error(err)
        }
      }
      if (!protocol || protocol === 'udp') {
        socket.createUdpServer({pipeline, name, port, handler})
      }
      if (!protocol || protocol === 'tcp') {
        socket.createTcpServer({pipeline, name, port, handler})
      }
    }
  }
}

module.exports = {
  create: create
}
