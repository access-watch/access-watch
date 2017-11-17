const Tail = require('tail').Tail

function create ({path, parse}) {
  return {
    name: 'File',
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
        try {
          const log = parse(data)
          pipeline.success(log)
        } catch (err) {
          pipeline.error(err)
        }
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
