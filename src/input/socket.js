const dgram = require('dgram');
const net = require('net');

const { fromJS } = require('immutable');

const defaultParse = s => fromJS(JSON.parse(s));

function createTcpServer({ status, log, port, handler }) {
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
      socket.on('error', err => {
        log(err, 'error');
      });
    })
    .listen(port, err => {
      if (err) {
        status(err, 'Cannot start: ' + err.message);
      } else {
        status(null, `Listening on TCP port ${port}.`);
      }
    });
}

function createUdpServer({ status, port, handler }) {
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
      status(err, 'Cannot start: ' + err.message);
    })
    .on('listening', () => {
      status(null, `Listening on UDP port ${port}.`);
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
    start: ({ success, reject, status, log }) => {
      const handler = message => {
        if (sample !== 1 && Math.random() > sample) {
          return;
        }
        try {
          success(parse(message));
        } catch (err) {
          reject(err);
        }
      };
      if (!protocol || protocol === 'udp') {
        udpServer = createUdpServer({ status, name, port, handler });
      }
      if (!protocol || protocol === 'tcp') {
        tcpServer = createTcpServer({ status, log, name, port, handler });
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
