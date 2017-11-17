const Tail = require('tail').Tail
const nginx = require('../format/nginx.js')

function create ({name = 'File', path, parse = nginx.parser()} = {}) {
  return {
    name: name,
    start: (pipeline) => {
      let tail
      try {
        tail = new Tail(path, {
          logger: {
            info: msg => {},
            error: err => pipeline.status(err, err.message)
          }
        })
      } catch (err) {
        return pipeline.status(err, err.message)
      }
      tail.on('line', (data) => {
        let log
        try {
          log = parse(data)
        } catch (err) {
          return pipeline.error(err)
        }
        pipeline.success(log)
      })
      tail.on('error', (err) => {
        pipeline.error(err)
      })
      tail.watch()
      pipeline.status(null, 'Watching ' + path)
    }
  }
}

module.exports = {
  create: create
}
