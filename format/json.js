const Ajv = require('ajv')
const { fromJS } = require('immutable')

const ajv = new Ajv()
const schema = require('./log-schema.json')
const validate = ajv.compile(schema)

function parser () {
  return function (msg) {
    const valid = validate(msg)
    if (!valid) {
      throw new Error('Incoming message is invalid.')
    } else {
      return fromJS(msg)
    }
  }
}

module.exports = {
  parser: parser
}
