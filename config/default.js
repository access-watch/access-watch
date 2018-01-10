const pipeline = require('../lib/pipeline');

/* Input configuration
====================== */

const input = require('../input');
const format = require('../format');

/* Syslog inputs
---------------- */

/* Syslog input in Nginx 'combined' format */

const syslogNginxCombinedInput = input.syslog.create({
  name: 'Syslog (nginx combined format)',
  port: 1514,
  parse: format.nginx.parser({ format: format.nginx.formats.combined }),
});

pipeline.registerInput(syslogNginxCombinedInput);

/* Syslog input in Nginx 'access_watch' format */

const syslogNginxAccessWatchInput = input.syslog.create({
  name: 'Syslog (nginx access_watch format)',
  port: 1515,
  parse: format.nginx.parser({ format: format.nginx.formats.accessWatch }),
});

pipeline.registerInput(syslogNginxAccessWatchInput);

/* Syslog input in Access Watch JSON format */

const syslogInput = input.syslog.create({
  name: 'Syslog (JSON standard format)',
  port: 1516,
});

pipeline.registerInput(syslogInput);

/* HTTP inputs
-------------- */

/* HTTP input in Access Watch JSON format */

const httpInput = input.http.create({
  name: 'HTTP server (JSON standard format)',
  path: '/input/log',
});

pipeline.registerInput(httpInput);

// Output to the console as JS object
// pipeline.map(log => console.log(log.toJS()))
