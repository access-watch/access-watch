const logsSearchArguments = {
  address: value => ({ address: { value } }),
  identity_type: type => ({ identity: { type } }),
  request_method: method => ({ request: { method } }),
  reputation_status: status => ({ reputation: { status } }),
  response_status: status => ({ response: { status } }),
  robot: id => ({ robot: { id } }),
};

module.exports = logsSearchArguments;
