const app = require('../lib/app')

function create ({endpoint, parse}) {
  return {
    name: 'HTTP endpoint',
    start: (pipeline) => {
      app.post(endpoint, (req, res) => {
        // No validation before sending the response to the client
        res.send('Ok')
        // Processing the message(s)
        let messages = Array.isArray(req.body) ? req.body : [req.body]
        messages.forEach(message => {
          try {
            const log = parse(req.body)
            pipeline.success(log)
          } catch (err) {
            pipeline.error(err)
          }
        })
      })
      pipeline.status(null, 'Listening at ' + endpoint)
    }
  }
}

module.exports = {
  create: create
}
