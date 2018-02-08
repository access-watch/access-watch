# Session with timerange

In the default configuration of Access Watch, sessions (Robots and Addresses) do not support timerange filtering.
To enable such support, the only solution for now is to activate elasticsearch in your configuration.

To do so, you should provide in your configuration :

```json
{
  "modules": {
    "elasticsearch": true
  }
}
```

To configure elasticsearch itself, you might also use the configuration as following :

```json
{
  "modules": {
    "elasticsearch": true
  },
  "elasticsearch": {
    "configuration": {}
  }
}
```

The configuration object present here will be passed down to the elasticsearch [client constructor](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/configuration.html).
