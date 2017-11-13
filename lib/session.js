/**
 * Database of user and bot sessions.
 */

const { Map } = require('immutable')

class Database {
  constructor () {
    this.sessions = Map()
  }

  // ensure the session exists and return it
  ensure (session) {
    const sessId = session.get('id')
    if (!this.sessions.has(sessId)) {
      this.sessions = this.sessions.set(sessId, session)
      return session
    } else {
      return this.sessions.get(sessId)
    }
  }

  get (sessId) {
    return this.sessions.get(sessId)
  }

  // Update the session by applying `f` to it
  update (id, f) {
    this.sessions = this.sessions.update(id, f)
  }

  // list all sessions
  list () {
    return this.sessions
  }
}

module.exports = new Database()
