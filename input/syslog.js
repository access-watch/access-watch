const syslogd = require('syslogd')

function create ({port, parse}) {
  return {
    name: 'Syslog',
    start: (pipeline) => {
      syslogd(msg => {
        try {
          const log = parse(msg.msg)
          pipeline.success(log)
        } catch (err) {
          pipeline.error(err)
        }
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
