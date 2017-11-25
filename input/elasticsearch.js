const elasticsearch = require('elasticsearch')
const { fromJS } = require('immutable')

function create ({name = 'Elasticsearch', config, query, parse}) {
  if (!query.body) {
    query.body = {}
  }
  if (!query.body.size) {
    query.body.size = 100
  }
  if (!query.body.sort) {
    query.body.sort = [ { '_doc': { order: 'desc' } } ]
  }
  return {
    name: name,
    start: (pipeline) => {
      const client = new elasticsearch.Client(config)
      // Keep track of the latest processed ids
      let ids = []
      // Only run once
      let running = false
      // Run if not running
      const run = () => {
        if (!running) {
          running = true
          poll()
        }
      }
      // Done
      const done = () => {
        running = false
        setTimeout(run, 333)
      }
      // Poll
      const poll = () => {
        running = true
        client.search(query).then(resp => {
          resp.hits.hits.reverse().forEach(hit => {
            // De-duplication
            let id = hit._id
            if (ids.includes(id)) {
              return
            } else {
              ids.push(id)
            }
            // Parse log
            try {
              if (parse) {
                pipeline.success(parse(hit._source))
              } else {
                pipeline.success(fromJS(hit._source))
              }
            } catch (err) {
              pipeline.error(err)
            }
          })
          // Keep list short
          ids.slice(-1 * query.body.size)
          done()
        }).catch(() => {
          done()
        })
      }
      // Start
      setImmediate(run)
      // Status
      pipeline.status(null, 'Polling ' + config.host)
    }
  }
}

module.exports = {
  create: create
}
