const elasticsearch = require('elasticsearch')

function create ({config, query, parse}) {
  return {
    name: 'Elasticsearch',
    start: (pipeline) => {
      const client = new elasticsearch.Client(config)
      // Keep track of the processed ids
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
          resp.hits.hits.forEach(hit => {
            // De-duplication
            let id = hit._id
            if (ids.includes(id)) {
              return
            } else {
              ids.push(id)
            }
            // Parse log
            try {
              const log = parse(hit._source)
              pipeline.success(log)
            } catch (err) {
              pipeline.error(err)
            }
          })
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
