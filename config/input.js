const pipeline = require('../lib/pipeline')

const input = require('../input')
const format = require('../format')

/* Syslog inputs accepting Nginx format */

const syslogNginxCombined = input.syslog.create({
  port: 1514,
  parse: format.nginx.parser({format: format.nginx.formats.combined})
})

pipeline.registerInput(syslogNginxCombined)

const syslogInputNginxAccessWatch = input.syslog.create({
  port: 1515,
  parse: format.nginx.parser({format: format.nginx.formats.accessWatch})
})

pipeline.registerInput(syslogInputNginxAccessWatch)

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
//     type: '__TYPE__',
//     body: {
//       size: 100,
//       sort: [ { '@timestamp': { order: 'desc' } } ]
//     }
//   },
//   parse: format.logstash.formats['HTTPD_COMBINEDLOG']
// })

// pipeline.registerInput(elasticsearchInput)

/* WebSocket input accepting pre-formatted logs */

// const websocketInput = input.websocket.create({
//  address: 'ws://HOST:PORT',
//  parse: format.json.parser()
// })

// pipeline.registerInput(websocketInput)
