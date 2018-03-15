const database = require('./database');
const config = require('../constants');

class FilterGroups {
  constructor() {
    this.searches = {
      log: [],
      robot: [],
      address: [],
    };
  }

  serialize() {
    return {
      searches: this.searches,
    };
  }

  static deserialize(data) {
    const db = new FilterGroups();
    if (data) {
      db.searches = data.searches;
    }
    return db;
  }

  add({ search, type }) {
    this.searches[type].push(search);
  }

  remove({ id, type }) {
    this.searches[type] = this.searches[type].filter(
      search => search.id !== id
    );
  }

  reorder({ oldIndex, newIndex, type }) {
    const [moving] = this.searches[type].splice(oldIndex, 1);
    this.searches[type].splice(newIndex, 0, moving);
  }

  update({ type, search }) {
    const searches = this.searches[type];
    const index = searches.findIndex(fg => fg.id === search.id);
    searches[index] = Object.assign({}, searches[index], search);
  }

  list() {
    return this.searches;
  }
}

function connect({ name, protocol } = {}) {
  const conn = database.connect({
    name: name || 'searches',
    protocol: protocol || config.data.protocol,
    Klass: FilterGroups,
  });
  return conn.db;
}

module.exports = { connect };
