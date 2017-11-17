const app = require('../lib/app')

function create ({name = 'HTTP endpoint', endpoint, parse}) {
  return {
    name: name,
    start: (pipeline) => {
      app.post(endpoint, (req, res) => {
        // No validation before sending the response to the client
        res.send('Ok')
        // Processing the message(s)
        let messages = Array.isArray(req.body) ? req.body : [req.body]
        messages.forEach(message => {
          let log
          try {
            log = parse(req.body)
          } catch (err) {
            return pipeline.error(err)
          }
          pipeline.success(log)
        })
      })
      pipeline.status(null, 'Listening at ' + endpoint)
    }
  }
}

module.exports = {
  create: create
}
