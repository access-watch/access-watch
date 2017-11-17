const syslogd = require('syslogd')

function create ({name = 'Syslog', port = 514, parse} = {}) {
  return {
    name: name,
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
          pipeline.status(null, `Listening on port ${port}.`)
          console.log(`${name} listening on port ${port}.`)
        }
      })
    }
  }
}

module.exports = {
  create: create
}
