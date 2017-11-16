const { fromJS } = require('immutable')

const formats = {}

// Source:
// https://github.com/logstash-plugins/logstash-patterns-core/blob/master/patterns/httpd

formats['HTTPD_COMBINEDLOG'] = (source) => {
  let headers = {}
  if (source.agent !== '-') {
    headers['user-agent'] = source.agent
  }
  if (source.referrer !== '-') {
    headers['referer'] = source.referrer
  }

  const request = {
    time: source['@timestamp'],
    address: source.clientip,
    method: source.verb,
    url: source.request,
    captured_headers: ['user-agent', 'referer'],
    headers
  }

  const response = {
    status: source.response
  }

  return fromJS({request, response})
}

function parser ({format}) {
  return (msg) => format(msg)
}

module.exports = {
  formats: formats,
  parser: parser
}
