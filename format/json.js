function parser () {
  return function (msg) {
    return typeof msg === 'string' ? JSON.parse(msg) : msg
  }
}

module.exports = {
  parser: parser
}
