const { fromJS, Map } = require('immutable');

const metrics = require('../lib/metrics').connect();

const reducers = require('../lib/reducers');
const { FixedWindow } = require('../lib/window');
const { now, iso } = require('../lib/util');

// Pipeline

const { stream } = require('../pipeline/augmented');

function requestMetrics(log) {
  return fromJS({
    name: 'request',
    tags: {
      type: log.getIn(['identity', 'type'], 'unknown'),
      status: log.getIn(['reputation', 'status'], 'ok'),
      country: log.getIn(['address', 'country_code'], 'unknown'),
    },
    value: 1,
  });
}

stream
  .map(requestMetrics)
  .by(metrics.encodeSeries)
  .window({
    strategy: new FixedWindow(1),
    reducer: reducers.count(),
  })
  .add(() => {
    return event => {
      metrics.add(event.get('data').set('time', event.get('time')));
      return event;
    };
  });

// API endpoints

const app = require('../lib/api');

function parseTimestamp(query, name) {
  const ts = parseInt(query[name]);
  if (isNaN(ts) || ts < 0) {
    throw new Error(
      'The parameter "' + name + '" should be a timestamp in seconds.'
    );
  }
  return ts;
}

function parsePosInt(query, name) {
  const n = parseInt(query[name]);
  if (isNaN(n) || n < 0) {
    throw new Error(
      'The parameter "' + name + '" should be a positive integer.'
    );
  }
  return n;
}

const reservedParameters = ['dateFormat', 'start', 'end', 'step', 'by'];

function parseRequest(req) {
  let query = Map({ name: req.params.name });
  if (!req.query) {
    return query;
  }
  if (req.query.start) {
    query = query.set('start', parseTimestamp(req.query, 'start'));
  }
  if (req.query.end) {
    query = query.set('end', parseTimestamp(req.query, 'end'));
  } else {
    query = query.set('end', now());
  }
  if (req.query.step) {
    query = query.set('step', parsePosInt(req.query, 'step'));
  }
  if (req.query.by) {
    query = query.set('by', req.query.by);
  }
  const tags = Map(req.query).removeAll(reservedParameters);
  if (!tags.isEmpty()) {
    query = query.set('tags', tags);
  }
  return query;
}

app.get('/metrics/:name', (req, res) => {
  let query;
  try {
    query = parseRequest(req);
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
  let data = metrics.query(query);
  if (req.query && req.query.dateFormat === 'iso8601') {
    data = data.map(([t, v]) => [iso(t), v]);
  }
  res.send(data);
});
