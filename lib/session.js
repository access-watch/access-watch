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
      this.sessions = this.sessions.filter(s => s.get('updated') >= cutoff)
      console.log('Deleted', oldCount - this.sessions.size, 'sessions.')
    }.bind(this), 3600 * 1000)
  }

  // ensure the session exists and return it
  ensure (session) {
    const sessId = session.get('id')
    if (!this.sessions.has(sessId)) {
      this.sessions = this.sessions.set(sessId, Map({'updated': now(), 'session': session}))
      return session
    } else {
      return this.get(sessId)
    }
  }

  get (sessId) {
    return this.sessions.getIn([sessId, 'session'])
  }

  // Update the session by applying `f` to it
  update (id, f) {
    this.sessions = this.sessions.update(id, session => {
      return session
        .set('updated', now())
        .update('session', f)
    })
  }

  // list all sessions
  list () {
    return this.sessions.map(s => s.get('session'))
  }

  close () {
    clearInterval(this.gc)
  }
}

module.exports = new Database()
