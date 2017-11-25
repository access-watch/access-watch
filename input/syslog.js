const syslogd = require('syslogd')
const { fromJS } = require('immutable')

function create ({name = 'Syslog', port = 514, parse}) {
  return {
    name: name,
    start: (pipeline) => {
      syslogd(msg => {
        try {
          if (parse) {
            pipeline.success(parse(msg.msg))
          } else {
            pipeline.success(fromJS(JSON.parse(msg.msg)))
          }
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
