const Tail = require('tail').Tail
const { fromJS } = require('immutable')

function create ({name = 'File', path, parse}) {
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
        try {
          if (parse) {
            pipeline.success(parse(data))
          } else {
            pipeline.success(fromJS(JSON.parse(data)))
          }
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
