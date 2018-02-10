const WebSocket = require('ws');
const { fromJS } = require('immutable');

const app = require('../apps/websocket');

const defaultParse = s => fromJS(JSON.parse(s));

const socketToPipeline = (
  success,
  reject,
  parse = defaultParse,
  sample = 1
) => socket => {
  socket.on('message', message => {
    if (sample !== 1 && Math.random() > sample) {
      return;
    }
    try {
      success(parse(message));
    } catch (err) {
      reject(err);
    }
  });
};

const setupClientWebSocket = ({ status, address, listenSocket }) => {
  let socket = new WebSocket(address);
  status(null, 'Waiting for connection to ' + address);
  socket.on('open', () => {
    status(null, 'Listening to ' + address);
  });
  socket.on('error', err => {
    status(err, 'Websocket error');
  });
  socket.on('close', event => {
    status(event, event.reason || 'Websocket has been closed');
  });
  listenSocket(socket);
  return socket;
};

const setupServerWebSocket = ({ status, path, listenSocket }) => {
  app.ws(path, listenSocket);
  status(null, `Listening on ws://__HOST__${path}`);
};

function create({
  name = 'WebSocket',
  address,
  path,
  type = 'client',
  parse,
  sample = 1,
}) {
  let client;
  return {
    name: `${name} ${type}`,
    start: ({ success, reject, status, log }) => {
      const listenSocket = socketToPipeline(success, reject, parse, sample);
      if (type === 'client') {
        client = setupClientWebSocket({ status, address, listenSocket });
      } else if (type === 'server') {
        setupServerWebSocket({ status, path, listenSocket });
      } else {
        const errMsg = 'WebSocket type is either client or server';
        log(new Error(errMsg), 'error');
      }
    },
    stop: () => {
      if (client) client.close();
    },
  };
}

module.exports = {
  create: create,
};
