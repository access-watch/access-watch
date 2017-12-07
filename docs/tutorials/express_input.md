In this tutorial, we'll start analysing the web traffic on a Node/Express application using Access Watch.

We'll use the Websocket protocol that is one of the many protocol available with the Access Watch Express Logger middleware.

Let's start!

### Install Access Watch

On the same server where the Node/Express application is running, or on a server that is reachable by it, install the Access Watch processor.

As a prerequirement, you'll need Node.js &gt;= 7. Use nvm if you're in trouble.

```bash
nvm install node
```

During the beta phase, let's use Git and clone the public repository:

```bash
git clone https://github.com/access-watch/access-watch.git
cd access-watch
npm install
```

### Configure Access Watch

In our suggested configuration, Access Watch will be listening for access logs using the Websocket protocol.

All communications between your Node/Express application and Access Watch will be happening in clear, so please only use that setup in your internal network. If on the public internet, we're advising to use the Websocket Secure protocol (wss) which is straightforward but out of the scope of this tutorial.

Now, you can create your own configuration in `./config/config.js`:

```javascript
const pipeline = require('../lib/pipeline')

const input = require('../input')
const format = require('../format')

const webSocketServerInput = input.websocket.create({
  name: 'WebSocket server (JSON standard format)',
  type: 'server',
  path: '/input/log'
})

pipeline.registerInput(webSocketServerInput)
```

### Configure Node/Express

Now, install the Access Watch Express Logger middleware in your Node application:

```bash
npm install --save access-watch-express-logger
```

Then simply configure it like any other middlewares:

```javascript
const express = require('express')
const accessWatchExpressLogger = require('access-watch-express-logger')

const app = express()

app.use(accessWatchExpressLogger('websocket', 'ws://localhost:3000/input/log'))

```

In this example, there are 3 important things:

1. If Access Watch is running on the same server, we can use `localhost` as IP address.
If it's on a different server, replace `localhost` by the proper private or public IP address.
2. Replace the port (here `3000`) by the relevant one, it should be the main port where Access Watch is running.
3. Finally, the path `/input/log` should match the one configured on Access Watch side, If you're following this tutorial from start to begin, nothing to change!

Now, that you added and configured the Access Watch middleware, you can deploy and restart your application.

Note: The Access Watch middleware is also capable of logging using the HTTP(s) or the Syslog protocol. If you have any trouble with Websocket, you might want to try these one.

### Start Access Watch

Ok, now go back to where Access Watch is installed and start it.

```bash
npm start config/config.js
```

### Browse the interface

Now, you can point your browser to the IP/port where Access Watch is running. If you see data flowing, congrats you made it!

![Access Watch Metrics](https://access.watch/assets/2/img/dashboard-metrics.png)

![Access Watch Robots](https://access.watch/assets/2/img/dashboard-robots.png)

### More than 'watch'

The interface is just the start for Access Watch, the real fun is on building your own web traffic monitoring pipeline!

Check back soon, our advanced tutorials are coming.
