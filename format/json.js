const { fromJS } = require('immutable')

function parser () {
  return function (msg) {
    return fromJS(msg)
  }
}

module.exports = {
  parser: parser
}
