## Monitor traffic data from Elasticsearch

These days, one of the most common setup to analyze 'access logs' is to store them in Elasticsearch, usually using Filebeat and/or Logstash in the process.

In this setup, the logs are sometime useful but they are usually underused. However the data is easy to query, and they make a great first case to evaluate Access Watch. You just to have to configure Access Watch to poll data from the Elasticsearch cluster and configure it with the proper format.

This is what we will do, step by step, with this tutorial.

### Install Access Watch

On the same server where Nginx is running, or on a server that is reachable by it, install the Access Watch processor.

As a prerequirement, you'll need Node.js >= 7. Use nvm if you're in trouble:

```
nvm install node
```

During the beta phase, let's use Git and clone the public repository:

```
git clone https://github.com/access-watch/access-watch.git
cd access-watch
npm install
```

### Configure Access Watch

We will configure a new input polling data from Elasticsearch.

Edit <strong>config/input.js</strong> and start with the following.

```
const elasticsearchInput = input.elasticsearch.create({
  config: {
    host: '__HOST__:__PORT__'
  },
  query: {
    index: '__INDEX__',
    type: '__TYPE__',
    body: {
      sort: [ { '__TIME__': { order: 'desc' } } ]
    }
  },
  parse: __PARSER__
})

pipeline.registerInput(elasticsearchInput)
```

You will need to replace ```__HOST__```, ```__PORT__```, ```__INDEX__``` and ```__TYPE__``` with the values that are matching your setup.

So, if the URL to access the data in Elasticsearch is:

```http://10.200.0.52:9200/logstash-2017.11.20/access_log/_search```

You will set the following configuration:

```
  config: {
    host: '10.200.0.52:9200'
  },
  query: {
    index: 'logstash-2017.11.20',
    type: 'access_log'
  }
```

Now, we would like to make sure that we always query the latest results. Assuming that you have a date available as a ```@timestamp``` key, simply use:

```
  sort: [ { '@timestamp': { order: 'desc' } } ]
```

Finally, we need to transform the logs from their current format in Elasticsearch to the internal format used for the Access Watch inputs.

Maybe you're lucky and you can reuse an existing format, such as the default Logstash setup. In that case:

```
  parse: format.logstash.formats['HTTPD_COMBINEDLOG']
```

Otherwise, don't panic, you can write your own, you'll just have to make sure that the mandatory properties are set. To know more about [Access Watch's internal log format](https://github.com/access-watch/access-watch/blob/master/docs/log.md), [check the documentation](https://github.com/access-watch/access-watch/blob/master/docs/log.md).


When writing your own parser, you can start from this template and fill the blanks:

```javascript
function parser (source) {
  const request = {
    time: __TIME__,
    address: __ADDRESS__,
    method: __METHOD__,
    url: __URL__,
    captured_headers: [
      'user-agent',
      'referer'
    ],
    headers: {
      'user-agent': __USER_AGENT__,
      'referer': __REFERER__
    }
  }

  const response = {
    status: __STATUS_CODE__
  }

  return fromJS({request, response})
}
```

So, for example, if your logs would be formated like the following:

```json
{
  "request" : "/",
  "agent" : "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
  "auth" : "-",
  "ident" : "-",
  "verb" : "GET",
  "type" : "nginx",
  "path" : "/var/log/nginx/access.log",
  "referrer" : "-",
  "@timestamp" : "2017-11-20T00:00:09.000Z",
  "response" : 200,
  "bytes" : 5888,
  "clientip" : "87.250.224.108",
  "httpversion" : "1.1"
}
```

You could write this parser function:

```javascript
const { fromJS } = require('immutable')

function myCustomParser (source) {
  let headers = {}

  if (source.agent !== '-') {
    headers['user-agent'] = source.agent
  }
  if (source.referrer !== '-') {
    headers['referer'] = source.referrer
  }

  const request = {
    time: source['@timestamp'],
    address: source.clientip,
    method: source.verb,
    url: source.request,
    captured_headers: ['user-agent', 'referer'],
    headers
  }

  const response = {
    status: source.response
  }

  return fromJS({request, response})
}
```

Now, everything together, the final input configuration:

```
const elasticsearchInput = input.elasticsearch.create({
  config: {
    host: '10.200.0.52:9200'
  },
  query: {
    index: 'logstash-2017.11.20',
    type: 'access_log',
    body: {
      sort: [ { '@timestamp': { order: 'desc' } } ]
    }
  },
  parse: myCustomParser
})

pipeline.registerInput(elasticsearchInput)
```

### Start Access Watch

Ok, now go back to where Access Watch is installed and start it:

```
npm start
```

### Browse the interface

<p>Now, you can point your browser to the IP/port where Access Watch is running. If you're trying from your own computer, that would be http://0.0.0.0:3000/. If you see data flowing, congrats you made it!</p>

<img style="display:block;margin:20px auto" src="http://access.watch/assets/2/img/dashboard-metrics.png" alt="" style="max-width:85%;">

<img style="display:block;margin:20px auto" src="http://access.watch//assets/2/img/dashboard-robots.png" alt="" style="max-width:85%;">

### More than 'watch'

The interface is just the start for Access Watch, the real fun is on building your own web traffic monitoring pipeline!

Check back soon, our advanced tutorial is coming.
