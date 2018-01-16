const WebSocket = require('ws');
const { fromJS } = require('immutable');

const app = require('../lib/app');

const defaultParse = s => fromJS(JSON.parse(s));

const socketToPipeline = (
  pipeline,
  parse = defaultParse,
  sample = 1
) => socket => {
  socket.on('message', message => {
    if (sample !== 1 && Math.random() > sample) {
      return;
    }
    try {
      pipeline.success(parse(message));
    } catch (err) {
      pipeline.error(err);
    }
  });
};

const setupClientWebSocket = ({ pipeline, address, listenSocket }) => {
  let socket = new WebSocket(address);
  pipeline.status(null, 'Waiting for connection to ' + address);
  socket.on('open', _ => {
    pipeline.status(null, 'Listening to ' + address);
  });
  socket.on('error', err => {
    pipeline.status(err, 'Websocket error');
  });
  socket.on('close', event => {
    pipeline.status(event, event.reason || 'Websocket has been closed');
  });
  listenSocket(socket);
};

const setupServerWebSocket = ({ pipeline, path, listenSocket }) => {
  app.ws(path, listenSocket);
  pipeline.status(null, `Listening on ws://__HOST__${path}`);
};

function create({
  name = 'WebSocket',
  address,
  path,
  type = 'client',
  parse,
  sample = 1,
}) {
  return {
    name: `${name} ${type}`,
    start: pipeline => {
      const listenSocket = socketToPipeline(pipeline, parse, sample);
      if (type === 'client') {
        setupClientWebSocket({ pipeline, address, listenSocket });
      } else if (type === 'server') {
        setupServerWebSocket({ pipeline, path, listenSocket });
      } else {
        const errMsg = 'WebSocket type is either client or server';
        pipeline.error(new Error(errMsg), errMsg);
      }
    },
  };
}

module.exports = {
  create: create,
};
