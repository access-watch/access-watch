const rc = require('rc')

const constants = {
  metrics: {
    gc: {
      expiration: 24 * 3600,
      interval: 3600 * 1000
    }
  },
  session: {
    gc: {
      expiration: 3600,
      interval: 3600 * 1000,
    }
  }
}

const config = rc('access-watch', constants)

module.exports = config
