const WebSocket = require('ws')

function create ({address, parse}) {
  return {
    name: 'WebSocket',
    start: (pipeline) => {
      let socket = new WebSocket(address)
      pipeline.status(null, 'Waiting for connection to ' + address)
      socket.on('open', _ => {
        pipeline.status(null, 'Listening to ' + address)
      })
      socket.on('message', stringMessage => {
        const json = JSON.parse(stringMessage)
        const messages = Array.isArray(json) ? json : [json]
        messages.forEach(message => {
          let log
          try {
            log = parse(message)
          } catch (err) {
            return pipeline.error(err)
          }
          pipeline.success(log)
        })
      })
      socket.on('error', err => {
        pipeline.status(err, 'Websocket error')
      })
      socket.on('close', event => {
        pipeline.status(event, event.reason || 'Websocket has been closed')
      })
    }
  }
}

module.exports = {
  create: create
}
