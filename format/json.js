const Ajv = require('ajv')
const { fromJS } = require('immutable')

const ajv = new Ajv()
const schema = require('./log-schema.json')

function parser () {
  return function (msg) {
    const valid = ajv.validate(schema, msg)
    if (!valid) {
      throw new Error('Invalid message: ' + ajv.errorsText())
    } else {
      return fromJS(msg)
    }
  }
}

module.exports = {
  parser: parser
}
