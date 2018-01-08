# Global Configuration

The variables configuration is done with the help of the [rc](https://www.npmjs.com/package/rc) node module.

Our recommended way to configure the variables is to add a `.access-watchrc` at the root of your project folder.

This file can be in either `JSON` (recommended) or `ini` format.

Here is an example of how this file can look like :
```JSON
{
  "port": 4000,
  "metrics": {
    "gc": {
      "expiration": 3600
    }
  }
}
```

This example would make the app be served on the 4000 port and ask the metrics to be garbage collected if they are more than one hour old.

You can find below the list of all configurable variables:

## Global

| Variable name | Type                  | Description                                                 |
| ---           | ---                   | ----                                                        |
| port          | integer               | The port the app is running on                              |
| pipeline      | [pipeline](#pipeline) | Pipeline properties                                         |
| metrics       | [metrics](#metrics)   | Metrics properties                                          |
| session       | [session](#session)   | Session properties                                          |
| rules         | [rules](#rules)       | Rules properties                                            |
| hub           | [hub](#hub)           | Hub properties                                              |

## Pipeline

| Variable name        | Type    | Description                                                                                          |
| ---                  | ---     | ----                                                                                                 |
| allowedEventLateness | integer | The allowed lateness of an event entering the pipeline, if the event comes later, it will be dropped |
| watermarkDelay       | integer | Delay removed from the current time when comparing to the event time                                 |

## Metrics

| Variable name | Type      | Description                                                 |
| ---           | ---       | ----                                                        |
| gc            | [GC](#GC) | Garbage collection property, see [GC](#GC)                  |

## Rules

| Variable name | Type      | Description                                                 |
| ---           | ---       | ----                                                        |
| gc            | [GC](#GC) | Garbage collection property, see [GC](#GC)                  |

## Session

| Variable name | Type      | Description                                                 |
| ---           | ---       | ----                                                        |
| gc            | [GC](#GC) | Garbage collection property, see [GC](#GC)                  |

### GC

| Variable name | Type      | Description                                                                             |
| ---           | ---       | ----                                                                                    |
| expiration    | integer   | Duration (in seconds) without activity after which an element will be garbage collected |
| interval      | integer   | Interval ( in ms ) at each the garbage collection will be called                        |

## Hub

| Variable name | Type            | Description                                                 |
| ---           | ---             | ----                                                        |
| cache         | [cache](#cache) | The cache property, see [cache](#cache)                     |


### Cache
| Variable name | Type            | Description                                                 |
| ---           | ---             | ----                                                        |
| max           | integer         | Maximum length of items the cache will keep.                |
| maxAge        | integer         | Maximum age of an item kept in cache, in ms.                |
