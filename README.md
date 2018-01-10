![](https://access.watch/assets/img/access-watch-banner-3.png)

[![Build Status](https://travis-ci.org/access-watch/access-watch.svg?branch=master)](https://travis-ci.org/access-watch/access-watch)
[![Slack Channel](http://slack.access.watch/badge.svg)](http://slack.access.watch/)

Access Watch is a flexible access log processor that helps operators analyze the web traffic reaching their infrastructure.

Access Watch is built on a real-time stream processor handling logs from inputs of any type:

 * CDNs (Cloudfront, Cloudflare, Akamai, ...)
 * Load Balancers (ELB)
 * Reverse Proxies (Nginx, Haproxy, ...)
 * Web Servers (Nginx, Apache, ...)
 * Applications (Node, Ruby, PHP, ...)

Access Watch is currently in open beta. For more details, go to: https://access.watch

![](https://access.watch/assets/img/access-watch-metrics.png)

## Install

Make sure you have Node.js version >= 7. We recommend using [nvm](https://github.com/creationix/nvm).

```bash
git clone https://github.com/access-watch/access-watch.git
cd access-watch
npm install
```

## Start

```bash
npm start
```

It's loading the default configuration, it's the same as:

```bash
npm start config/default
```

## Configure

The first thing you might want is configuring inputs to connect Access Watch to your traffic sources and convert it in the proper format.

In order to do this, you need to create a new configuration file such as `config/custom.js`.

See [Input Configuration](./docs/input.md) for the list of available input types and how to configure them.

There are also a couple of constants you might configure with a simple config file, to learn more you can head to [Constants Configuration](./docs/configuration.md).

### Start with custom configuration

```shell
npm start config/custom
```

The Access Watch API and interface will be served from port `3000` by default.

You can change that using an environment variable:

```shell
PORT=80 npm start config/custom
```

### Browse the interface

Now, you can point your browser on the address:port where Access Watch is running, for example http://localhost:3000/.

If you see data flowing, congratulations you made it!

**Warning**: There is currently no built in authentication mechanism, if installed on a public server, you need to properly configure a firewall to restrict access to it.

## Tutorials

 - [Monitor web traffic with syslog input from Nginx](https://access.watch/documentation/nginx)
 - [Monitor web traffic with input from Elasticsearch](https://access.watch/documentation/elasticsearch)

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
