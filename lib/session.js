/**
 * Database of user and bot sessions.
 */

const { fromJS, Map } = require('immutable');
const { iso, now } = require('./util');
const { Speed } = require('./speed');
const database = require('./database');
const config = require('../config/constants');

function withSpeed(session) {
  return session
    .updateIn(['speed', 'per_minute'], speed => speed.compute())
    .updateIn(['speed', 'per_hour'], speed => speed.compute());
}

function aggregateSpeed(session, type) {
  return session.getIn(['speed', type]).reduce((p, c) => p + c, 0);
}

// The size of the session database
function size(sessions) {
  return sessions.reduce((total, sessions) => total + sessions.size, 0);
}

class Database {
  constructor() {
    this.sessions = Map();
    this.indexes = Map();
  }

  gc() {
    const cutoff = now() - config.session.gc.expiration;
    const oldCount = size(this.sessions);
    this.sessions = this.sessions.map(sessions =>
      sessions.filter(s => s.get('end') >= cutoff)
    );
    console.log(
      `Garbage collected ${oldCount -
        size(this.sessions)} sessions older than ${iso(cutoff)}.`
    );

    // Update and Slice Indexes
    this.indexes = this.indexes.map((indexes, type) =>
      indexes.map((index, key) => {
        if (key === '24h') {
          index = index.map((count, id) => {
            const session = this.get(type, id);
            if (session) {
              return aggregateSpeed(session, 'per_hour');
            }
          });
        } else if (key === '15m') {
          index = index.map((count, id) => {
            const session = this.get(type, id);
            if (session) {
              return aggregateSpeed(session, 'per_minute');
            }
          });
        }
        return index
          .filter(s => s !== undefined)
          .sort()
          .reverse()
          .slice(0, config.session.gc.indexSize);
      })
    );
  }

  serialize() {
    return {
      sessions: this.sessions.toJS(),
      indexes: this.indexes.toJS(),
    };
  }

  static deserialize(data) {
    const db = new Database();
    if (data && data.sessions) {
      db.sessions = fromJS(data.sessions).map(sessions => {
        return sessions.map(session => {
          return session
            .updateIn(['speed', 'per_minute'], speed =>
              Speed.deserialize(speed.toJS())
            )
            .updateIn(['speed', 'per_hour'], speed =>
              Speed.deserialize(speed.toJS())
            );
        });
      });
    }
    if (data && data.indexes) {
      db.indexes = fromJS(data.indexes);
    }
    return db;
  }

  // assign a session to an event
  assign({ type, id, time, gap }) {
    let session = this.sessions.getIn([type, id]);
    if (!session || time - session.get('end') > gap) {
      session = Map({
        type: type,
        id: id,
        updated: now(),
        start: time,
        end: time + gap,
        speed: Map({
          per_minute: new Speed(60, 15).hit(time),
          per_hour: new Speed(3600, 24).hit(time),
        }),
      });
    } else {
      session = session
        .set('updated', now())
        .update('start', start => Math.min(start, time))
        .update('end', end => Math.max(end, time))
        .updateIn(['speed', 'per_minute'], speed => speed.hit(time))
        .updateIn(['speed', 'per_hour'], speed => speed.hit(time));
    }
    this.save(session);
    this.index(session);
    return session;
  }

  index(session) {
    this.indexes = this.indexes.updateIn(
      [session.get('type'), '24h', session.get('id')],
      0,
      n => n + 1
    );
    this.indexes = this.indexes.updateIn(
      [session.get('type'), '15m', session.get('id')],
      0,
      n => n + 1
    );
  }

  // save session data
  save(session) {
    this.sessions = this.sessions.setIn(
      [session.get('type'), session.get('id')],
      session
    );
  }

  // session of the given type and with the given id
  get(type, id) {
    const session = this.sessions.getIn([type, id]);
    if (session) {
      return withSpeed(session);
    }
  }

  // list all sessions of a given type
  list({ type, sort, filter, limit }) {
    let sessions, index;
    if (sort === 'count' || sort === 'per_hour') {
      index = this.indexes.getIn([type, '24h'], Map());
    } else if (sort === 'speed' || sort === 'per_minute') {
      index = this.indexes.getIn([type, '15m'], Map());
    }
    index = index.sort().reverse();
    sessions = index
      .keySeq()
      .map(key => this.get(type, key))
      .filter(s => s !== undefined);
    if (filter) {
      sessions = sessions.filter(filter);
    }
    if (limit) {
      sessions = sessions.slice(0, limit);
    }
    return sessions;
  }

  stats() {
    return {
      sessions: this.sessions.map(vals => vals.size),
    };
  }
}

function connect({ name, protocol } = {}) {
  const conn = database.connect({
    name: name || 'session',
    protocol: protocol || config.data.protocol,
    Klass: Database,
    gcInterval: config.session.gc.interval,
  });
  return conn.db;
}

module.exports = { connect };
