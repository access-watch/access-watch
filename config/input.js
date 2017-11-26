const pipeline = require('../lib/pipeline')

const input = require('../input')
const format = require('../format')

/* Syslog inputs */

const syslogNginxCombinedInput = input.syslog.create({
  name: 'Syslog (nginx combined format)',
  port: 1514,
  parse: format.nginx.parser({format: format.nginx.formats.combined})
})

pipeline.registerInput(syslogNginxCombinedInput)

const syslogNginxAccessWatchInput = input.syslog.create({
  name: 'Syslog (nginx access_watch format)',
  port: 1515,
  parse: format.nginx.parser({format: format.nginx.formats.accessWatch})
})

pipeline.registerInput(syslogNginxAccessWatchInput)

const syslogInput = input.syslog.create({
  name: 'Syslog (JSON standard format)',
  port: 1516
})

pipeline.registerInput(syslogInput)

/* HTTP input */

const httpInput = input.http.create({
  name: 'HTTP server (JSON standard format)',
  path: '/input/log'
})

pipeline.registerInput(httpInput)

/* WebSocket input */

// const webSocketServerInput = input.websocket.create({
//   name: 'WebSocket server (JSON standard format)',
//   type: 'server',
//   path: '/input/log'
// })

// pipeline.registerInput(webSocketServerInput)

/* File inputs accepting Nginx format */

// const fileInputNginxCombined = input.file.create({
//   path: '/var/log/nginx/access.log',
//   parse: format.nginx.parser({
//     format: format.nginx.formats.combined
//   })
// })

// pipeline.registerInput(fileInputNginxCombined)

// const fileInputNginxAccessWatch = input.file.create({
//   path: '/var/log/nginx/access_watch.log',
//   parse: format.nginx.parser({
//     format: format.nginx.formats.accessWatch
//   })
// })

// pipeline.registerInput(fileInputNginxAccessWatch)

/* Elasticsearch input (polling) accepting a commonly used Logstash format */

// const elasticsearchInput = input.elasticsearch.create({
//   config: {
//     host: '__HOST__:__PORT__'
//   },
//   query: {
//     index: '__INDEX__',
//     type: '__TYPE__'
//   },
//   parse: format.logstash.formats['HTTPD_COMBINEDLOG']
// })

// pipeline.registerInput(elasticsearchInput)

/* WebSocket client input accepting pre-formatted logs */

// const websocketInput = input.websocket.create({
//  address: 'ws://HOST:PORT'
// })

// pipeline.registerInput(websocketInput)

/* WebSocket server input accepting pre-formatted logs */

// const websocketServerInput = input.websocket.create({
//   type: 'server',
//   endpoint: '/myLogs'
// })

// pipeline.registerInput(websocketServerInput)
