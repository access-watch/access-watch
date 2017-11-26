const syslogd = require('syslogd')
const { fromJS } = require('immutable')

const defaultParse = s => fromJS(JSON.parse(s))

function create ({name = 'Syslog', port = 514, parse = defaultParse}) {
  return {
    name: name,
    start: (pipeline) => {
      syslogd(msg => {
        try {
          pipeline.success(parse(msg.msg))
        } catch (err) {
          pipeline.error(err)
        }
      }).listen(port, err => {
        if (err) {
          pipeline.status(err, 'Cannot start: ' + err.message)
        } else {
          pipeline.status(null, `Listening on UDP port ${port}.`)
          console.log(`${name} listening on UDP port ${port}.`)
        }
      })
    }
  }
}

module.exports = {
  create: create
}
