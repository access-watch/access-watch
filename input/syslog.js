const net = require('net')
const dgram = require('dgram')

const syslogParse = require('syslog-parse')

const { fromJS } = require('immutable')

function createTcpServer ({pipeline, name, port, parse}) {
  return net
    .createServer(socket => {
      socket.on('data', data => {
        data.toString().split('\n').forEach(line => {
          if (line) {
            try {
              const result = syslogParse(line)
              pipeline.success(parse(result.message))
            } catch (err) {
              pipeline.error(err)
            }
          }
        })
      })
    })
    .listen(port, err => {
      if (err) {
        pipeline.status(err, 'Cannot start: ' + err.message)
      } else {
        pipeline.status(null, `Listening on port ${port}.`)
        console.log(`${name} listening on TCP port ${port}.`)
      }
    })
}

function createUdpServer ({pipeline, name, port, parse}) {
  return dgram
    .createSocket('udp4')
    .on('message', message => {
      try {
        const result = syslogParse(message.toString())
        pipeline.success(parse(result.message))
      } catch (err) {
        pipeline.error(err)
      }
    })
    .on('error', err => {
      pipeline.status(err, 'Cannot start: ' + err.message)
    })
    .on('listening', () => {
      pipeline.status(null, `Listening on port ${port}.`)
      console.log(`${name} listening on UDP port ${port}.`)
    })
    .bind(port)
}

const defaultParse = s => fromJS(JSON.parse(s))

function create ({name = 'Syslog', protocol, port = 514, parse = defaultParse}) {
  return {
    name: name,
    start: pipeline => {
      if (!protocol || protocol === 'udp') {
        createUdpServer({pipeline, name, port, parse})
      }
      if (!protocol || protocol === 'tcp') {
        createTcpServer({pipeline, name, port, parse})
      }
    }
  }
}

module.exports = {
  create: create
}
