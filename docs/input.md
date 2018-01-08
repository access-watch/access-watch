# Input Configuration

Input configuration consists in 3 steps:

1. Instantiating a [type of input](#input-types) with the right configuration
2. Optionnaly indicating to the input [how to parse the access logs](#other-formats)
3. Registering the input with the pipeline

You can configure and register as many inputs as you need. The web interface will show you the configured inputs, their status and how much traffic is going through them.

## Input Types

 * All inputs support by default single logs in the [Access Watch JSON format](#json-format).
 * All inputs support an optional `parse` parameter for other formats.

### Syslog

The syslog input listens for syslog messages containing access logs.

The input accepts the following options.

| Attribute | Type    | Required? | Description                                                 |
| ---       | ---     | ---       | ---                                                         |
| port      | integer | yes       | The port to listen to.                                      |
| parse     | Parser  | no        | A function to parse the syslog message. (See [Formats](#other-formats) below) |

### Socket

The socket input listens for raw messages containing access logs.

The input accepts the following options.

| Attribute | Type    | Required? | Description                                                 |
| ---       | ---     | ---       | ---                                                         |
| port      | integer | yes       | The port to listen to.
| protocol  | string  | no        | 'udp' or 'tcp'.  If not provided, listen to both.
| parse     | Parser  | no        | A function to parse the message. (See [Formats](#other-formats) below) |

### File

The file input tails a file on the same machine. Each line represents an access log.

The input accepts the following options.

| Attribute | Type   | Required? | Description                                                  |
| ---       | ---    | ---       | ---                                                          |
| path      | string | yes       | The path of the file.                                        |
| parse     | Parser | no        | A function to parse a line from the file (See [Formats](#other-formats) below) |

**Note**: The file input does not read the whole file but starts tailing for logs as soon as Access Watch starts.

### HTTP

The HTTP input listens for HTTP requests containing access logs.

The input accepts the following options.

| Attribute | Type   | Required? | Description                                                |
| ---       | ---    | ---       | ---                                                        |
| path      | string | yes       | The path where to listen for logs.                         |
| parse     | Parser | no        | A function to parse the request's body (See [Formats](#other-formats) below) |

**Note**: The input mounts the configured endpoint to the same web server as Access Watch.

### WebSocket

The WebSocket input subscribe to a WebSocket server sending access logs.

The input accepts the following options.

| Attribute | Type   | Required?                 | Description                                                         |
| ---       | ---    | ---                       | ---                                                                 |
| type      | string | no                        | Either 'client' or 'server' (default to 'client')                   |
| address   | string | yes (if type is 'client') | The WebSocket address to connect to (e.g. 'wss://localhost:3000')   |
| path      | string | yes (if type is 'server') | The path where to listen for logs                                   |
| parse     | Parser | no                        | A function to parse the messages from the queue (See Formats below) |

### Elasticsearch

The Elasticsearch input polls logs from an Elasticsearch cluster.

The input accepts the following options.

| Attribute | Type   | Required? | Description                                                              |
| ---       | ---    | ---       | ---                                                                      |
| config    | object | yes       | The configuration for the [Elasticsearch client](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/configuration.html).                                            |
| query     | object | yes       | The [Elasticsearch search query](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html#api-search)                                                       |
| parse     | Parser | no        | A function to parse the messages (See [Formats](#other-formats) below)      |

## JSON Format

The JSON log parser parses access log in JSON that match the following schema.

```
{
  "$schema": "http://json-schema.org/draft-06/schema#",
  "description": "A representation of an HTTP request as seen from a web server.",
  "type": "object",
  "required": ["request", "response"],
  "properties": {
    "request": {
      "type": "object",
      "required": ["time", "address", "method", "url", "headers"],
      "properties": {
        "time": {
          "type": "string",
          "format": "date-time"
        },
        "address": {
          "type": "string",
          "anyOf": [
            {"format": "ipv4"},
            {"format": "ipv6"}
          ]
        },
        "scheme": {
          "type": "string",
          "enum": ["http", "https"]
        },
        "method": {
          "type": "string"
        },
        "url": {
          "type": "string"
        },
        "captured_headers": {
          "type": "array"
        },
        "headers": {
          "type": "object"
        }
      }
    },
    "response": {
      "type": "object",
      "required": ["status"]
    }
  }
}
```

## Other Formats

### Nginx

The Nginx log format parser allows you to specify a log format using a [Nginx log format specification](http://nginx.org/en/docs/http/ngx_http_log_module.html#log_format).

If you are using Nginx, you can simply copy-and-paste the format specification from the Nginx configuration file to the Access Watch input configuration file.

```javascript
{
  parse: format.nginx.parser({
    format: '$remote_addr - $remote_user [$time_local] "$request" $status $bytes_sent "$http_referer" "$http_user_agent"'
  })
}
```

Access Watch is distributed with two Nginx formats.

 * The default `combined` format:
`'$remote_addr - $remote_user [$time_local] "$request" $status $bytes_sent "$http_referer" "$http_user_agent"'`

* the `access_watch_combined` format that extracts important HTTP headers from the request:
`'$remote_addr - $remote_user [$time_local] "$request" $status $bytes_sent "$http_referer" "$http_user_agent" "$http_accept" "$http_accept_charset" "$http_accept_encoding" "$http_accept_language" "$http_connection" "$http_dnt" "$http_from" "$http_host"'`.

If possible, we recommend you to use the `access_watch_combined` format to take full advantage of the Access Watch data augmentation in the pipeline.

### Apache

The Apache log format parser allows you to specify a log format using [Apache log configuration](http://httpd.apache.org/docs/current/mod/mod_log_config.html).

If you are using Apache, you can simply copy-and-paste the format specification from the Apache configuration file to the Access Watch input configuration file.

```javascript
{
  parse: format.apache.parser({
    format: '%h %l %u %t "%r" %>s %b "%{Referer}i" "%{User-agent}i"'
  })
}
```

Access Watch is distributed with two Apache formats.

 * The default `combined` format:
`'%h %l %u %t "%r" %>s %b "%{Referer}i" "%{User-agent}i"'`

* the `access_watch_combined` format that extracts important HTTP headers from the request:
`'%h %l %u %t "%r" %>s %b "%{Referer}i" "%{User-agent}i" "%{Accept}i" "%{Accept-Charset}i" "%{Accept-Encoding}i" "%{Accept-Language}i" "%{Connection}i" "%{Dnt}i" "%{From}i" "%{Host}i"'`.

If possible, we recommend you to use the `access_watch_combined` format to take full advantage of the Access Watch data augmentation in the pipeline.

### Custom

If Access Watch does not support your access log format you can implement your own log format parser.

In order to work with Access Watch, your format JavaScript module must follow a few simple rules.

1. The module must export a `parser` function
2. The parser function accepts an object containing the options of your format.
3. The parser function must return a parser (see below)

A **parser** is a function that takes a message as a JavaScript string and return a log that conforms to the [specification](./log.md).

If you're using a standard log format, do not hesitate to create a ticket in the Access Watch github project to request support for it.

## Examples

### Basic

Simple real-time log processing of [Nginx's predefined combined](http://nginx.org/en/docs/http/ngx_http_log_module.html#log_format) log format with a log file located at `/var/log/nginx/access.log` can be achieved with the following configuration:

```javascript
const pipeline = require('../lib/pipeline')
const input = require('../input')
const format = require('../format')

const nginxInput = input.file.create({
  path: '/var/log/nginx/access.log',
  parse: format.nginx.parser({format: format.nginx.formats.combined})
})

pipeline.registerInput(nginxInput)
```

When placed in `config/custom.js` it can be used by Access Watch with:

```
npm start config/custom
```

### Detailed

For more detailed log processing, it is recommended to use the *Access Watch combined* log format:

```
log_format access_watch_combined '$remote_addr - $remote_user [$time_local] "$request" $status $bytes_sent "$http_referer" "$http_user_agent" "$http_accept" "$http_accept_charset" "$http_accept_encoding" "$http_accept_language" "$http_connection" "$http_dnt" "$http_from" "$http_host" "$http_x_forwarded_for"'
access_log /logs/access.log access_watch_combined;
```

With the following configuration for Access Watch:

```
const defaultInput = input.file.create({
  path: '/logs/access.log',
  parse: format.nginx.parser({format: format.nginx.formats.accessWatchCombined})
})
```

### Behind a proxy

If behind a proxy, you might want to also report the `HTTP_X_FORWARDED_FOR` header to allow Access Watch to properly detect the client IP address.

```
log_format access_watch_combined_with_x_forwarded_for '$remote_addr - $remote_user [$time_local] "$request" $status $bytes_sent "$http_referer" "$http_user_agent" "$http_accept" "$http_accept_charset" "$http_accept_encoding" "$http_accept_language" "$http_connection" "$http_dnt" "$http_from" "$http_host" "$http_x_forwarded_for"'
access_log /logs/access.log access_watch_combined_with_x_forwarded_for;
```

With the following configuration for Access Watch:

```
const defaultInput = input.file.create({
  path: '/logs/access.log',
  parse: format.nginx.parser({
    format: '$remote_addr - $remote_user [$time_local] "$request" $status $bytes_sent "$http_referer" "$http_user_agent" "$http_accept" "$http_accept_charset" "$http_accept_encoding" "$http_accept_language" "$http_connection" "$http_dnt" "$http_from" "$http_host" "$http_x_forwarded_for"'
  })
})
```