const pipeline = require('../lib/pipeline')

const input = require('../input')
const format = require('../format')

/* Syslog input */

const syslogInput = input.syslog.create({
  name: 'Syslog (JSON standard format)',
  port: 1516,
  parse: format.json.parser()
})

pipeline.registerInput(syslogInput)

/* HTTP input */

const httpInput = input.http.create({
  name: 'HTTP server (JSON standard format)',
  path: '/input/log',
  parse: format.json.parser()
})

pipeline.registerInput(httpInput)

// Output to the console as JS object
// pipeline.map(log => console.log(log.toJS()))
