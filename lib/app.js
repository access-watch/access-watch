const express = require('express');
const expressWs = require('express-ws');

const config = require('../config/constants');

const app = express();
expressWs(app);

app.set('port', process.env.PORT || config.port);

app.start = () => {
  app.listen(app.get('port'), () => {
    console.log(
      'HTTP and Websocket Server listening on port %d',
      app.get('port')
    );
  });
};

module.exports = app;
