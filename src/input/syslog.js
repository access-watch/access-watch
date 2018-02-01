const syslogParse = require('syslog-parse');

const { fromJS } = require('immutable');

const socket = require('./socket');

const defaultParse = s => fromJS(JSON.parse(s));

function create({
  name = 'Syslog',
  protocol,
  port = 514,
  parse = defaultParse,
  sample = 1,
}) {
  return {
    name: name,
    start: pipeline => {
      const handler = message => {
        if (sample !== 1 && Math.random() > sample) {
          return;
        }
        try {
          const result = syslogParse(message);
          pipeline.success(parse(result.message));
        } catch (err) {
          pipeline.log(err, 'warn');
        }
      };
      if (!protocol || protocol === 'udp') {
        socket.createUdpServer({ pipeline, name, port, handler });
      }
      if (!protocol || protocol === 'tcp') {
        socket.createTcpServer({ pipeline, name, port, handler });
      }
    },
  };
}

module.exports = {
  create: create,
};
