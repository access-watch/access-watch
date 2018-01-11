const path = require('path');

let config;

if (process.argv[2]) {
  config = path.resolve(process.cwd(), process.argv[2]);
} else {
  config = path.resolve(__dirname, './default');
}

require(config);

require('../dashboard');
