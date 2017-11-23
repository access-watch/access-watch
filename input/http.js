const app = require('../lib/app')

function create ({name = 'HTTP', path, parse}) {
  return {
    name: name,
    start: (pipeline) => {
      app.post(path, (req, res) => {
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
      pipeline.status(null, `Listening on port ${app.get('port')} at ${path}`)
    }
  }
}

module.exports = {
  create: create
}
