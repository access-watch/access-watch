const WebSocket = require('ws')
const app = require('../lib/app')

const socketToPipeline = (pipeline, parse) => socket => {
  socket.on('message', message => {
    let log
    try {
      log = parse(JSON.parse(message))
    } catch (err) {
      return pipeline.error(err)
    }
    pipeline.success(log)
  })
}

const setupClientWebSocket = ({ pipeline, address, listenSocket }) => {
  let socket = new WebSocket(address)
  pipeline.status(null, 'Waiting for connection to ' + address)
  socket.on('open', _ => {
    pipeline.status(null, 'Listening to ' + address)
  })
  socket.on('error', err => {
    pipeline.status(err, 'Websocket error')
  })
  socket.on('close', event => {
    pipeline.status(event, event.reason || 'Websocket has been closed')
  })
  listenSocket(socket)
}

const setupServerWebSocket = ({ pipeline, endpoint, listenSocket }) => {
  app.ws(endpoint, listenSocket)
  pipeline.status(null, 'Listening at ' + endpoint)
}

function create ({address, endpoint, type = 'client', parse}) {
  return {
    name: 'WebSocket',
    start: (pipeline) => {
      const listenSocket = socketToPipeline(pipeline, parse)
      if (type === 'client') {
        setupClientWebSocket({ pipeline, address, listenSocket })
      } else if (type === 'server') {
        setupServerWebSocket({ pipeline, endpoint, listenSocket })
      } else {
        const errMsg = 'WebSocket type is either client or server'
        pipeline.error(new Error(errMsg), errMsg)
      }
    }
  }
}

module.exports = {
  create: create
}
