const syslogd = require('syslogd')
const nginx = require('../format/nginx.js')

function create ({port = 514, parser = nginx.parser()} = {}) {
  return {
    name: 'Syslog',
    start: (pipeline) => {
      syslogd(msg => {
        let log
        try {
          log = parser(msg.msg)
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
