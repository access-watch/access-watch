const { fromJS } = require('immutable')

function parser () {
  return function (msg) {
    const object = typeof msg === 'string' ? JSON.parse(msg) : msg

    return fromJS(object)
  }
}

module.exports = {
  parser: parser
}
