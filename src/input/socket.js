const dgram = require('dgram');
const net = require('net');

const { fromJS } = require('immutable');

const defaultParse = s => fromJS(JSON.parse(s));

function createTcpServer({ pipeline, port, handler }) {
  return net
    .createServer(socket => {
      socket.on('data', data => {
        data
          .toString()
          .split('\n')
          .forEach(line => {
            if (line) {
              handler(line);
            }
          });
      });
    })
    .listen(port, err => {
      if (err) {
        pipeline.status(err, 'Cannot start: ' + err.message);
      } else {
        pipeline.status(null, `Listening on TCP port ${port}.`);
      }
    });
}

function createUdpServer({ pipeline, port, handler }) {
  return dgram
    .createSocket('udp4')
    .on('message', message => {
      message
        .toString()
        .split('\n')
        .forEach(line => {
          if (line) {
            handler(line);
          }
        });
    })
    .on('error', err => {
      pipeline.status(err, 'Cannot start: ' + err.message);
    })
    .on('listening', () => {
      pipeline.status(null, `Listening on UDP port ${port}.`);
    })
    .bind(port);
}

function create({
  name = 'Socket',
  protocol,
  port,
  parse = defaultParse,
  sample = 1,
}) {
  let udpServer, tcpServer;
  return {
    name: name,
    start: pipeline => {
      const handler = message => {
        if (sample !== 1 && Math.random() > sample) {
          return;
        }
        try {
          pipeline.success(parse(message));
        } catch (err) {
          pipeline.reject(err);
        }
      };
      if (!protocol || protocol === 'udp') {
        udpServer = createUdpServer({ pipeline, name, port, handler });
      }
      if (!protocol || protocol === 'tcp') {
        tcpServer = createTcpServer({ pipeline, name, port, handler });
      }
    },
    stop: () => {
      const promises = [];
      if (udpServer) {
        promises.push(new Promise(resolve => udpServer.close(resolve)));
      }
      if (tcpServer) {
        promises.push(new Promise(resolve => tcpServer.close(resolve)));
      }
      return Promise.all(promises);
    },
  };
}

module.exports = {
  createTcpServer,
  createUdpServer,
  create,
};
