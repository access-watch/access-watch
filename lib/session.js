/**
 * Database of user and bot sessions.
 */

const { Map, Range } = require('immutable')
const { iso, now } = require('./util')

/**
 * Helper to compute session speed.
 */
class Speed {
  constructor (size) {
    this.size = size
    this.counters = {}
  }

  hit (time) {
    const idx = time - time % 60
    if (this.counters[idx] === undefined) {
      this.counters[idx] = 1
    } else {
      this.counters[idx]++
    }
    return this
  }

  compute () {
    const time = now()
    const currentMinute = time - time % 60
    return Range(0, this.size)
      .map(n => {
        return this.counters[currentMinute - n * 60]
      })
      .filter(c => c !== undefined)
  }
}

function withSpeed (session) {
  return session.update('speed', speed => speed.compute())
}

// The size of the session database
function size (sessions) {
  return sessions.reduce((total, sessions) => total + sessions.size, 0)
}

function gc (sessions) {
  const cutoff = now() - 3600
  console.log('Garbage collecting sessions older than', iso(cutoff))
  const oldCount = size(sessions)
  console.log(oldCount + ' sessions in the database.')
  sessions = sessions.map(sessions => sessions.filter(s => s.get('end') >= cutoff))
  console.log('Deleted', oldCount - size(sessions), 'sessions.')
  return sessions
}

class Database {
  constructor () {
    this.sessions = Map()
    this.gc = setInterval(function () {
      this.sessions = gc(this.sessions)
    }.bind(this), 3600 * 1000)
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
        speed: new Speed(15).hit(time)
      })
    } else {
      session = session
        .set('updated', now())
        .update('start', start => Math.min(start, time))
        .update('end', end => Math.max(end, time))
        .update('count', n => n + 1)
        .update('speed', speed => speed.hit(time))
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
      const aggregateSpeed = session => session.get('speed').reduce((p, c) => p + c, 0)
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

  close () {
    clearInterval(this.gc)
  }
}

const databases = {}

function createDatabase (name, options) {
  if (databases[name]) {
    throw new Error('A database with the same name already exists.')
  }
  databases[name] = new Database(options)
  return databases[name]
}

module.exports = {
  createDatabase: (name, options) => createDatabase(name, options),
  getDatabase: (name) => databases[name]
}
