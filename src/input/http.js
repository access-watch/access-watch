const { fromJS } = require('immutable');

const app = require('../apps/api');

function create({ name = 'HTTP server', path, parse = fromJS }) {
  return {
    name: name,
    start: ({ success, reject, status }) => {
      app.post(path, (req, res) => {
        // No validation before sending the response to the client
        res.send('Ok');
        // Processing the message(s)
        let messages = Array.isArray(req.body) ? req.body : [req.body];
        messages.forEach(message => {
          try {
            success(parse(message));
          } catch (err) {
            reject(err);
          }
        });
      });
      status(null, `Listening on http://__HOST__${path}`);
    },
  };
}

module.exports = {
  create: create,
};
