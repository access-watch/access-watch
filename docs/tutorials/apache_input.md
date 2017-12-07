In this tutorial, we'll start analysing the web traffic on one or many Apache web servers using Access Watch.

We'll use the syslog protocol that is available to us through the powerful **[Piped Logs](https://httpd.apache.org/docs/2.4/logs.html#piped)** feature of Apache.

Let's start.

### Install Access Watch

On the same server where Apache is running, or on a server that is reachable by it, install the Access Watch processor.

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

In our suggested configuration, Access Watch will be listening for access logs in the the `access_watch_combined` format on port `1518`.

We always recommand using the `access_watch_combined` format, which is logging more detailed information and allows for a much better analysis than the regular `combined` format.

To get more familiar, you can inspect default and example configurations in `./config/default.js` and `./config/example.js` file.

Now, you can create your own configuration in `./config/apache.js`:

```javascript
const pipeline = require('../lib/pipeline')

const input = require('../input')
const format = require('../format')

const syslogApacheAccessWatchCombinedInput = input.syslog.create({
  port: 1518,
  parse: format.apache.parser({
    format: format.apache.formats.accessWatchCombined
  })
})

pipeline.registerInput(syslogApacheAccessWatchCombinedInput)
```

### Configure Apache

First, if you're following our recommendation and opted for the `access_watch_combined` format, you need to define it in the Apache configuration. This will not replace the standard log format, just create an additional one.

```
LogFormat "%h %l %u %t \"%r\" %>s %b \"%{Referer}i\" \"%{User-agent}i\" \"%{Accept}i\" \"%{Accept-Charset}i\" \"%{Accept-Encoding}i\" \"%{Accept-Language}i\" \"%{Connection}i\" \"%{Dnt}i\" \"%{From}i\" \"%{Host}i\"" access_watch_combined
```

Note that you're free to use whatever `LogFormat`, you just need to properly report it in the Access Watch configuration.

Second, you need to instruct Apache where to send the access logs. If it's not the same, you need to make sure that Apache can reach the server where Access Watch is running.

```
CustomLog "|/usr/bin/logger -n localhost -P 1518 --rfc3164" access_watch_combined
```

Note: This is known to be working on *Ubuntu 16.04* with *logger 2.27.1*, let us know if you're in trouble and using something else.

In this example, there are 3 important things:

1. If Access Watch is running on the same server, we can use `localhost` as IP address.
If it's on a different server, replace `localhost` by the proper private or public IP address.
2. We configured Access Watch to listen for syslog messages in the `access_watch_combined` format on port `1518`.
We're properly passing that port in the configuration
3. Finally, we're asking Apache to use the `access_watch_combined` log format we previously configured.

Don't forget to reload Aapche with the updated configuration. On Ubuntu, it would be:

```bash
service apache2 reload
```

### Start Access Watch

Ok, now go back to where Access Watch is installed and start it.

```bash
npm start config/apache.js
```

### Browse the interface

Now, you can point your browser to the IP/port where Access Watch is running. If you see data flowing, congrats you made it!

![Access Watch Metrics](https://access.watch/assets/2/img/dashboard-metrics.png)

![Access Watch Robots](https://access.watch/assets/2/img/dashboard-robots.png)

### More than 'watch'

The interface is just the start for Access Watch, the real fun is on building your own web traffic monitoring pipeline!

Check back soon, our advanced tutorials are coming.
