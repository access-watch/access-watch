/**
 * Database of user and bot sessions.
 */

const { fromJS, Map } = require('immutable');
const { now } = require('./util');
const { Speed } = require('./speed');
const database = require('./database');
const config = require('../constants');
const instruments = require('./instruments');

function withSpeed(session) {
  return session
    .updateIn(['speed', 'per_minute'], speed => speed.compute())
    .updateIn(['speed', 'per_hour'], speed => speed.compute());
}

function withRule(rules) {
  return (session, type) => rules.getSessionWithRule({ type, session });
}

function aggregateSpeed(session, type) {
  return session.getIn(['speed', type]).reduce((p, c) => p + c, 0);
}

class Database {
  constructor() {
    this.sessions = Map();
    this.indexes = Map();
    this.withRule = s => s;
  }

  setRulesProvider(rules) {
    this.rules = rules;
    this.withRule = withRule(rules);
  }

  gc() {
    const gcStart = process.hrtime();

    // Filtering old Sessions
    const cutoff = now() - config.session.gc.expiration;
    this.sessions = this.sessions.map((sessions, type) => {
      const gcExpiredStart = process.hrtime();
      sessions = sessions.filter(s => s.get('end') >= cutoff);
      instruments.hrtime(`session.${type}.gc.expired.time`, gcExpiredStart);
      return sessions;
    });

    // Update and Slice Indexes
    this.indexes = this.indexes.map((indexes, type) => {
      const gcIndexesStart = process.hrtime();
      indexes = indexes.map((index, key) => {
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
      });
      instruments.hrtime(`session.${type}.gc.indexes.time`, gcIndexesStart);
      return indexes;
    });

    instruments.hrtime('session.gc.time', gcStart);

    const gcEnd = process.hrtime(gcStart);
    const elapsed = gcEnd[0] + Math.round(gcEnd[1] / 1000000) / 1000;
    console.log(`Session Garbage Collection in ${elapsed}s`);
  }

  instrument() {
    this.sessions.entrySeq().forEach(([key, value]) => {
      instruments.gauge(`sessions.${key}.size`, value.size);
    });
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
      return this.withRule(withSpeed(session), type);
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
