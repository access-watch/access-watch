const Tail = require('tail').Tail;
const { fromJS } = require('immutable');

const defaultParse = s => fromJS(JSON.parse(s));

function create({ name = 'File', path, parse = defaultParse }) {
  return {
    name: name,
    start: pipeline => {
      let tail;
      try {
        tail = new Tail(path, {
          logger: {
            info: () => {},
            error: err => pipeline.status(err, err.message),
          },
        });
      } catch (err) {
        return pipeline.status(err, err.message);
      }
      tail.on('line', data => {
        try {
          pipeline.success(parse(data));
        } catch (err) {
          pipeline.log(err, 'warn');
        }
      });
      tail.on('error', err => {
        pipeline.log(err, 'error');
      });
      tail.watch();
      pipeline.status(null, 'Watching ' + path);
    },
  };
}

module.exports = {
  create: create,
};
