const { fromJS } = require('immutable')

const app = require('../lib/app')

function create ({name = 'HTTP server', path, parse}) {
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
            if (parse) {
              pipeline.success(parse(message))
            } else {
              pipeline.success(fromJS(message))
            }
          } catch (err) {
            pipeline.error(err)
          }
        })
      })
      pipeline.status(null, `Listening on http://__HOST__${path}`)
    }
  }
}

module.exports = {
  create: create
}
