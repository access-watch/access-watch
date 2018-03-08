/**
 * Stream processing language.
 *
 * An event is an immutable map with the following keys:
 *
 *  time  int     required   Number of seconds since UNIX epoch.
 *  data  any     required   An event's data.
 *  key   string  optional   A way to group events together
 *
 * This modules provides functions to build a pipeline, a tree of stream processors.
 */
const Ajv = require('ajv');
const { Map, List } = require('immutable');
const { now, complement, iso } = require('./util');
const monitoring = require('./monitoring');
const instruments = require('./instruments');

const config = require('../constants');

const schema = require('../format/log-schema.json');
const validator = new Ajv();
const validate = validator.compile(schema);

function log(log, severity = 'warn') {
  console[severity](log);
  if (severity === 'error') {
    console.trace(log);
  }
}

/**
 * Print `f(event)` to the console and return event.
 */
function trace(f) {
  return stream => {
    return event => {
      console.log(JSON.stringify(f(event), null, 2));
      forward(stream, event);
    };
  };
}

/**
 * Forward an event to a stream.
 */
function forward(stream, event) {
  try {
    stream(event);
  } catch (reason) {
    log(reason, 'warn');
  }
}

/**
 * Identity stream transformer.
 */
function identity() {
  return stream => stream;
}

/**
 * Applies `f` to each event.
 *
 * `f` can return an event or a Promise of an event.
 */
function map(f) {
  return stream => {
    return event => {
      const res = f(event.get('data'));
      if (res && res.then) {
        res
          .then(value => forward(stream, event.set('data', value)))
          .catch(reason => log(reason, 'warn'));
      } else {
        forward(stream, event.set('data', res));
      }
    };
  };
}

/**
 * Forward events if `pred(event)` returns true.
 */
function filter(pred) {
  return stream => {
    return event => {
      if (pred(event.get('data'))) {
        forward(stream, event);
      }
    };
  };
}

/**
 * Compose stream transformers sequentially.
 */
function comp(xfes) {
  const xfes_ = xfes.slice().reverse();
  return stream => {
    return xfes_.reduce((stream, xf) => xf(stream), stream);
  };
}

/**
 * Compose stream transformers in parallel.
 */
function multiplex(xfes) {
  return stream => {
    const streams = xfes.map(xf => xf(stream));
    return event => {
      streams.map(stream => forward(stream, event));
    };
  };
}

/**
 * Logically split the stream for each unique value of `f(event)`.
 *
 * Ignore `undefined` values.
 */
function by(f) {
  return stream => {
    return event => {
      const value = f(event.get('data'));
      if (value !== undefined) {
        forward(stream, event.set('key', value));
      }
    };
  };
}

// Holds the state of the windows
let windows = List();
let id = 0;
const nextId = () => id++;

/**
 * Group events according to a window strategy and apply a reducer to each window.
 *
 * If the stream is split (`by` was called), maintain a different window for each key.
 */
function window({
  strategy,
  reducer,
  allowedLateness,
  fireEvery,
  watermarkDelay,
}) {
  const id = nextId();
  return stream => {
    return event => {
      // Drop late events
      const t = event.get('time');
      const watermark = now() - watermarkDelay;
      instruments.gauge('pipeline.window.delta', t - watermark);
      if (t < watermark - allowedLateness) {
        console.log('WARNING', 'Dropping late event.');
        console.log(
          'Watermark:',
          iso(watermark),
          'Event time:',
          iso(t),
          'Delta:',
          t - watermark
        );
        return;
      }
      windows = windows.updateIn([id, event.get('key')], Map(), windows => {
        // assign event to windows
        let eventWindows = strategy.assign(event);
        // update windows
        windows = eventWindows.reduce((windows, window) => {
          return windows.update(
            window.get('start') + ':' + window.get('end'),
            window.set('acc', reducer.init()),
            w => {
              return w
                .update('acc', acc => reducer.step(acc, event.get('data')))
                .set('triggered', false);
            }
          );
        }, windows);
        // trigger windows (FIXME: Move this logic out of this function)
        windows = windows.map(window => {
          if (
            fireEvery &&
            watermark < window.get('end') &&
            watermark - window.get('lastFired', window.get('start')) >=
              fireEvery
          ) {
            forward(
              stream,
              Map({
                time: window.get('start'),
                data: reducer.result(window.get('acc')),
                key: event.get('key'),
              })
            );
            return window.set('lastFired', watermark);
          }
          if (window.get('end') <= watermark && !window.get('triggered')) {
            forward(
              stream,
              Map({
                time: window.get('start'),
                data: reducer.result(window.get('acc')),
                key: event.get('key'),
              })
            );
            return window.set('triggered', true);
          }
          return window;
        });
        // Garbage collect windows
        return windows.filter(
          window => window.get('end') >= watermark - allowedLateness
        );
      });
    };
  };
}

/**
 * Pipeline builder
 */
class Builder {
  constructor(xf) {
    this.xf = xf;
    this.children = [];
    this.watermarkDelay = config.pipeline.watermarkDelay;
    this.allowedLateness = config.pipeline.allowedLateness;
  }

  add(xf) {
    const child = new Builder(xf);
    this.children.push(child);
    return child;
  }

  map(f) {
    return this.add(map(f));
  }

  filter(pred) {
    return this.add(filter(pred));
  }

  split(pred) {
    return [this.add(filter(pred)), this.add(filter(complement(pred)))];
  }

  by(f) {
    return this.add(by(f));
  }

  window(opts) {
    if (!opts.watermarkDelay) {
      opts.watermarkDelay = this.watermarkDelay;
    }
    if (!opts.allowedLateness) {
      opts.allowedLateness = this.allowedLateness;
    }
    return this.add(window(opts));
  }

  trace(f = e => e) {
    return this.add(trace(f));
  }

  create() {
    if (this.children.length === 0) {
      return this.xf;
    }
    return comp([this.xf, multiplex(this.children.map(b => b.create()))]);
  }
}

class Pipeline extends Builder {
  constructor() {
    super(identity());
    this.inputs = [];
    this.monitors = [];
    this.stream = null;
    this.log = log;
  }

  registerInput(input) {
    this.inputs.push(input);
    this.monitors.push(
      monitoring.register({
        speeds: ['accepted', 'rejected'],
        name: input.name,
        type: 'input',
      })
    );
  }

  start() {
    this.stream = super.create()(() => {});
    var pipeline = this;
    this.inputs.map(function(input, idx) {
      const monitor = pipeline.monitors[idx];
      input.start({
        success: function(log) {
          instruments.increment('pipeline.success');
          const valid = validate(log.toJS());
          if (valid) {
            const event = Map({
              time: Math.floor(
                new Date(log.getIn(['request', 'time'])).getTime() / 1000
              ),
              data: log,
            });
            instruments.increment('pipeline.valid');
            monitor.hit('accepted', event.get('time'));
            pipeline.handleEvent(event);
          } else {
            instruments.increment('pipeline.invalid');
            monitor.hit('rejected');
            pipeline.log(
              `Invalid message: ${validator.errorsText(validate.errors)}`,
              'warn'
            );
          }
        },
        reject: function(reason) {
          instruments.increment('pipeline.reject');
          monitor.hit('rejected');
          pipeline.log(reason, 'warn');
        },
        status: function(err, msg) {
          if (err) {
            console.error(err);
          }
          console.log(input.name + ': ' + msg);
          monitor.status = msg;
        },
        log: pipeline.log,
      });
    });
  }

  stop() {
    return Promise.all(
      this.inputs.filter(input => input.stop).map(input => input.stop())
    );
  }

  handleEvent(event) {
    instruments.gauge('pipeline.event.delta', event.get('time') - now());
    forward(this.stream, event);
  }
}

module.exports = new Pipeline();
