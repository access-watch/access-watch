const rc = require('rc')

const constants = {
  port: 3000,
  pipeline: {
    allowedEventLateness: 60,
    watermarkDelay: 5
  },
  metrics: {
    gc: {
      expiration: 24 * 3600,
      interval: 3600 * 1000
    }
  },
  rules: {
    gc: {
      expiration: 24 * 3600,
      interval: 3600 * 1000
    }
  },
  session: {
    gc: {
      expiration: 3600,
      interval: 3600 * 1000
    }
  },
  hub: {
    cache: {
      max: 1000,
      maxAge: 3600 * 1000
    }
  }
}

const config = rc('access-watch', constants)

module.exports = config
