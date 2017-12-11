const dgram = require('dgram')
const net = require('net')

const { fromJS } = require('immutable')

const defaultParse = s => fromJS(JSON.parse(s))

function createTcpServer ({pipeline, name, port, handler}) {
  return net
    .createServer(socket => {
      socket.on('data', data => {
        data.toString().split('\n').forEach(line => {
          if (line) {
            handler(line)
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

function createUdpServer ({pipeline, name, port, handler}) {
  return dgram.createSocket('udp4')
    .on('message', message => {
      message.toString().split('\n').forEach(line => {
        if (line) {
          handler(line)
        }
      })
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

function create ({name = 'Socket', protocol, port, parse = defaultParse}) {
  return {
    name: name,
    start: pipeline => {
      const handler = message => {
        try {
          pipeline.success(parse(message))
        } catch (err) {
          pipeline.error(err)
        }
      }
      if (!protocol || protocol === 'udp') {
        createUdpServer({pipeline, name, port, handler})
      }
      if (!protocol || protocol === 'tcp') {
        createTcpServer({pipeline, name, port, handler})
      }
    }
  }
}

module.exports = {
  createTcpServer,
  createUdpServer,
  create
}
