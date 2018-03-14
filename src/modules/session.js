const { Map } = require('immutable');

const { session, rules } = require('../databases');
const { getSession: getSessionFromHub } = require('../plugins/hub');

// Pipeline

const { stream } = require('../pipeline/augmented');

const config = require('../constants');

rules.setTransformExports({
  robot: robotsRules =>
    Promise.resolve(
      robotsRules.map(rule =>
        rule.setIn(
          ['condition', 'addresses'],
          session.list({
            type: 'address',
            filter: address =>
              address.has('robots') &&
              address
                .get('robots')
                .has(rule.getIn(['condition', 'robot', 'id'])),
            sort: 'count',
          })
        )
      )
    ),
});

/**
 * Assign a session to the log event, create it if necessary.
 */
function sessionHandler({ type, gap, id }) {
  return stream => {
    return event => {
      const sessId = id(event.get('data'));
      if (sessId !== undefined) {
        const sess = session.assign({
          type: type,
          id: sessId,
          time: event.get('time'),
          gap: gap,
        });
        stream(event.setIn(['data', 'session'], sess));
      }
    };
  };
}

// Split the stream by session and augment each log with the session data

// Robots

const robotRequests = stream.add(
  sessionHandler({
    type: 'robot',
    gap: 30 * 60,
    id: log => log.getIn(['robot', 'id']),
  })
);

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

const ipRequests = stream.add(
  sessionHandler({
    type: 'address',
    gap: 30 * 60,
    id: log => log.getIn(['address', 'value']),
  })
);

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

const app = require('../apps/api');
const { filters } = require('access-watch-sdk');
const { getFiltersFnFromString } = require('../lib/filter');

function getSessionItemFilter(queryFilter, type) {
  return getFiltersFnFromString(queryFilter, filters[type], type);
}

app.get('/sessions/:type', (req, res, next) => {
  if (config.session.timerange && req.query.start && req.query.end) {
    next();
  } else {
    const { type } = req.params;
    res.send(
      session.list({
        type,
        sort: req.query.sort || 'count',
        filter:
          (req.query.filter && getSessionItemFilter(req.query.filter, type)) ||
          null,
        limit: (req.query.limit && parseInt(req.query.limit)) || 100,
      })
    );
  }
});

const getSession = (type, id) => {
  const s = session.get(type, id);
  if (s) {
    return Promise.resolve(s);
  }
  return getSessionFromHub({ type, id });
};

app.get('/sessions/:type/:id', (req, res) => {
  const { type, id } = req.params;
  getSession(type, id)
    .then(session => rules.getSessionWithRule({ type, session }))
    .then(s => {
      res.send(s);
    })
    .catch(() => {
      res.status(404).send({ error: 'Unknown session.' });
    });
});
