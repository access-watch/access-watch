const parseBunyanRequest = (strSource) => {
  const source = typeof strSource === 'string' ? JSON.parse(strSource) : strSource

  const request = {
    time: source.time,
    address: source.ip,
    method: source.method,
    url: source.url,
    headers: source.req.headers
  }

  const response = {
    status: source['status-code']
  }

  return {request, response}
}

function parser () {
  return parseBunyanRequest
}

module.exports = {
  parser
}
