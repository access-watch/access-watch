const Tail = require('tail').Tail;
const { fromJS } = require('immutable');

const defaultParse = s => fromJS(JSON.parse(s));

function create({ name = 'File', path, parse = defaultParse }) {
  return {
    name: name,
    start: ({ success, reject, status, log }) => {
      let tail;
      try {
        tail = new Tail(path, {
          logger: {
            info: () => {},
            error: err => status(err, err.message),
          },
        });
      } catch (err) {
        return status(err, err.message);
      }
      tail.on('line', data => {
        try {
          success(parse(data));
        } catch (err) {
          reject(err);
        }
      });
      tail.on('error', err => {
        log(err, 'error');
      });
      tail.watch();
      status(null, 'Watching ' + path);
    },
  };
}

module.exports = {
  create: create,
};
