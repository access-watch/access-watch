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
