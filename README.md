# Access Watch

Access Watch is a flexible access log processor that helps operators analyze the web traffic reaching their infrastructure.

Access Watch is built on a real-time stream processor handling logs from inputs of any type (CDN, Load Balancer, Reverse Proxy, Web Server, Application) using any protocol (rsyslog, Log shippers, HTTP API, HTTP polling, Websocket).

Access Watch is currently in beta and is already covering multiple great use cases.

[![Build Status](https://travis-ci.org/access-watch/access-watch.svg?branch=master)](https://travis-ci.org/access-watch/access-watch)

## Install

Make sure you have Node.js version >= 7. We recommend using [nvm](https://github.com/creationix/nvm).

```bash
npm install
```

## Start

```bash
npm start
```

### Configure

At a minimum you will need to tell Access Watch where to find the logs and in what format they are. In order to do this, you need to edit the input configuration file at `config/input.js`.

See [Input Configuration](./docs/input.md) for the list of available input types and how to configure them.

### Start

Ok, now go back to where Access Watch is installed and start it.

```shell
npm start
```

The Access Watch API and Interface will be served from port 3000 by default. You can change that using an environment variable.

```shell
export PORT=3000 npm start
```

**Warning**: There is no authentication mechanism in the Access Watch processor, if the server is on the public internet, you will need to setup your firewall properly to restrict access to it.

### Browse the interface

Now, you can point your browser on the IP/port where Access Watch is running.

If you see data flowing, congrats you made it!

## Tutorials

 - [Integrate with Nginx using syslog logging](https://access.watch/documentation/nginx)

## License

```
This software is licensed under the Apache License, version 2 ("ALv2"), quoted below.

Copyright 2017 Access Watch <https://access.watch>

Licensed under the Apache License, Version 2.0 (the "License"); you may not
use this file except in compliance with the License. You may obtain a copy of
the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations under
the License.
```
