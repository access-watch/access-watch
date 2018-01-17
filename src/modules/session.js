const { Map } = require('immutable');

const session = require('../lib/session').connect();

const { stream } = require('../pipeline/augmented');

// Split the stream by session and augment each log with the session data

// Robots

const robotRequests = stream.session({
  type: 'robot',
  gap: 30 * 60,
  id: log => log.getIn(['robot', 'id']),
});

robotRequests
  .map(log => {
    return log.update('session', session => {
      return session
        .set('robot', log.getIn(['robot']))
        .set(
          'identity',
          log.get('identity').update('type', t => (t === 'unknown' ? null : t))
        )
        .set('address', log.getIn(['address']))
        .set('user_agent', log.getIn(['user_agent']))
        .set('reputation', log.getIn(['robot', 'reputation']));
    });
  })
  .map(log => {
    session.save(log.get('session'));
    return log;
  });

// IPs

const ipRequests = stream.session({
  type: 'address',
  gap: 30 * 60,
  id: log => log.getIn(['address', 'value']),
});

ipRequests
  .map(log => {
    return log.update('session', session => {
      return session
        .set('address', log.get('address'))
        .update('robots', Map(), robots => {
          if (log.has('robot')) {
            return robots.set(log.getIn(['robot', 'id']), log.get('robot'));
          }
          return robots;
        })
        .update('user_agents', Map(), userAgents => {
          if (log.has('user_agent')) {
            return userAgents.set(
              log.getIn(['user_agent', 'id']),
              log.get('user_agent')
            );
          }
          return userAgents;
        });
    });
  })
  .map(log => {
    session.save(log.get('session'));
    return log;
  });

// API endpoints

const app = require('../lib/api');

function parseFilter(query, name) {
  const filter = query[name];
  const [path, values] = filter.split(':');
  const keyPath = path.split('.');
  const keyValues = values.split(',');
  return item => keyValues.indexOf(item.getIn(keyPath)) !== -1;
}

app.get('/sessions/:type', (req, res) => {
  res.send(
    session.list({
      type: req.params.type,
      sort: req.query.sort || 'count',
      filter: (req.query.filter && parseFilter(req.query, 'filter')) || null,
      limit: (req.query.limit && parseInt(req.query.limit)) || 100,
    })
  );
});

app.get('/sessions/:type/:id', (req, res) => {
  const s = session.get(req.params.type, req.params.id);
  if (s) {
    res.send(s);
  } else {
    res.status(404).send({ error: 'Unknown session.' });
  }
});
