const syslogd = require('syslogd')
const nginx = require('../format/nginx.js')

function create ({name = 'Syslog', port = 514, parse = nginx.parser()} = {}) {
  return {
    name: name,
    start: (pipeline) => {
      syslogd(msg => {
        let log
        try {
          log = parse(msg.msg)
        } catch (err) {
          return pipeline.error(err)
        }
        pipeline.success(log)
      }).listen(port, err => {
        if (err) {
          pipeline.status(err, 'Cannot start: ' + err.message)
        } else {
          pipeline.status(null, 'Listening on port ' + port + '.')
        }
      })
    }
  }
}

module.exports = {
  create: create
}
