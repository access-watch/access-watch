/**
 * Database of user and bot sessions.
 */

const { Map } = require('immutable')
const { iso, now } = require('./util')

class Database {
  constructor () {
    this.sessions = Map()
    this.gc = setInterval(function () {
      const cutoff = now() - 3600
      console.log('Garbage collecting sessions older than', iso(cutoff))
      const oldCount = this.sessions.size
      console.log(oldCount + ' sessions in the database.')
      this.sessions = this.sessions.filter(s => s.get('end') >= cutoff)
      console.log('Deleted', oldCount - this.sessions.size, 'sessions.')
    }.bind(this), 3600 * 1000)
  }

  // assign a session
  assign ({id, time, gap}) {
    let session = this.sessions.get(id)
    if (!session || (time - session.get('end')) > gap) {
      session = Map({
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
    this.sessions = this.sessions.set(id, session)
    return session
  }

  // save session data
  save (session) {
    this.sessions = this.sessions.set(session.get('id'), session)
  }

  // the session with the given ID
  get (id) {
    return this.sessions.get(id)
  }

  // list all sessions
  list () {
    return this.sessions
  }

  close () {
    clearInterval(this.gc)
  }
}

module.exports = new Database()
