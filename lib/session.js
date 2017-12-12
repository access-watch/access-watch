/**
 * Database of user and bot sessions.
 */

const { fromJS, Map } = require('immutable')
const { iso, now } = require('./util')
const { Speed } = require('./speed')
const database = require('./database')

function withSpeed (session) {
  return session
    .updateIn(['speed', 'per_minute'], speed => speed.compute())
    .updateIn(['speed', 'per_hour'], speed => speed.compute())
}

function aggregateSpeed (session) {
  return session.get('speed').reduce((p, c) => p + c, 0)
}

// The size of the session database
function size (sessions) {
  return sessions.reduce((total, sessions) => total + sessions.size, 0)
}

class Database {
  constructor () {
    this.sessions = Map()
  }

  gc () {
    const cutoff = now() - 3600
    const oldCount = size(this.sessions)
    console.log(oldCount + ' sessions in the database.')
    this.sessions = this.sessions.map(sessions => sessions.filter(s => s.get('end') >= cutoff))
    console.log(`Garbage collected ${oldCount - size(this.sessions)} sessions older than ${iso(cutoff)}.`)
  }

  serialize () {
    return {
      sessions: this.sessions.toJS()
    }
  }

  static deserialize (data) {
    const db = new Database()
    if (data) {
      db.sessions = fromJS(data.sessions).map(sessions => {
        return sessions.map(session => {
          return session
            .updateIn(['speed', 'per_minute'], Speed.deserialize)
            .updateIn(['speed', 'per_hour'], Speed.deserialize)
        })
      })
    }
    return db
  }

  // assign a session to an event
  assign ({type, id, time, gap}) {
    let session = this.sessions.getIn([type, id])
    if (!session || (time - session.get('end')) > gap) {
      session = Map({
        type: type,
        id: id,
        updated: now(),
        start: time,
        end: time + gap,
        count: 1,
        speed: {
          per_minute: new Speed(60, 15).hit(time),
          per_hour: new Speed(3600, 24).hit(time)
        }
      })
    } else {
      session = session
        .set('updated', now())
        .update('start', start => Math.min(start, time))
        .update('end', end => Math.max(end, time))
        .update('count', n => n + 1)
        .updateIn(['speed', 'per_minute'], speed => speed.hit(time))
        .updateIn(['speed', 'per_hour'], speed => speed.hit(time))
    }
    this.sessions = this.sessions.setIn([type, id], session)
    return session
  }

  // save session data
  save (session) {
    this.sessions = this.sessions.setIn([session.get('type'), session.get('id')], session)
  }

  // session of the given type and with the given id
  get (type, id) {
    const session = this.sessions.getIn([type, id])
    if (session) {
      return withSpeed(session)
    }
  }

  // list all sessions of a given type
  list ({type, sort, filter, limit}) {
    let sessions = this.sessions.get(type, Map()).map(withSpeed)
    if (sort === 'count') {
      sessions = sessions.sort((a, b) => b.get('count') - a.get('count'))
    } else if (sort === 'speed') {
      const aggregateSpeed = session => session.getIn(['speed', 'per_minute']).reduce((p, c) => p + c, 0)
      sessions = sessions.sort((a, b) => aggregateSpeed(b) - aggregateSpeed(a))
    }
    sessions = sessions.valueSeq()
    if (filter) {
      sessions = sessions.filter(filter)
    }
    if (limit) {
      sessions = sessions.slice(0, limit)
    }
    return sessions
  }
}

function connect (uri) {
  const conn = database.connect({
    uri: uri,
    Klass: Database,
    gcInterval: 3600 * 1000
  })
  return conn.db
}

module.exports = {
  connect: connect
}
