/**
 * Database of user and bot sessions.
 */

const { Map } = require('immutable')
const { iso, now } = require('./util')

// The size of the session database
function size (sessions) {
  return sessions.reduce((total, sessions) => total + sessions.size, 0)
}

class Database {
  constructor () {
    this.sessions = Map()
    this.gc = setInterval(function () {
      const cutoff = now() - 3600
      console.log('Garbage collecting sessions older than', iso(cutoff))
      const oldCount = size(this.sessions)
      console.log(oldCount + ' sessions in the database.')
      this.sessions = this.sessions.map(sessions => sessions.filter(s => s.get('end') >= cutoff))
      console.log('Deleted', oldCount - size(this.sessions), 'sessions.')
    }.bind(this), 3600 * 1000)
  }

  // assign a session
  assign ({type, id, time, gap}) {
    let session = this.sessions.getIn([type, id])
    if (!session || (time - session.get('end')) > gap) {
      session = Map({
        type: type,
        id: id,
        updated: time,
        start: time,
        end: time + gap
      })
    } else {
      session = session
        .set('updated', time)
        .update('start', start => Math.min(start, time))
        .update('end', end => Math.max(end, time))
    }
    this.sessions = this.sessions.setIn([type, id], session)
    return session
  }

  // save session data
  save (session) {
    this.sessions = this.sessions.setIn([session.get('type'), session.get('id')],
                                        session)
  }

  // session of the given type and with the given id
  get (type, id) {
    return this.sessions.getIn([type, id])
  }

  // list all sessions of a given type
  list (type) {
    return this.sessions.get(type, Map())
  }

  close () {
    clearInterval(this.gc)
  }
}

module.exports = new Database()
