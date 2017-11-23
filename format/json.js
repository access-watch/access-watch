const Ajv = require('ajv')
const { fromJS } = require('immutable')

const ajv = new Ajv()
const schema = require('./log-schema.json')

function parser () {
  return function (msg) {
    const object = typeof msg === 'string' ? JSON.parse(msg) : msg
    const valid = ajv.validate(schema, object)
    if (!valid) {
      throw new Error('Invalid message: ' + ajv.errorsText())
    } else {
      return fromJS(object)
    }
  }
}

module.exports = {
  parser: parser
}
