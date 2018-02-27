const database = require('./database');
const config = require('../constants');

class FilterGroups {
  constructor() {
    this.filterGroups = {
      log: [],
      robot: [],
      address: [],
    };
  }

  serialize() {
    return {
      filterGroups: this.filterGroups,
    };
  }

  static deserialize(data) {
    const db = new FilterGroups();
    if (data) {
      db.filterGroups = data.filterGroups;
    }
    return db;
  }

  add({ filterGroup, type }) {
    this.filterGroups[type].push(filterGroup);
  }

  remove({ id, type }) {
    this.filterGroups[type] = this.filterGroups[type].filter(
      filterGroup => filterGroup.id !== id
    );
  }

  reorder({ oldIndex, newIndex, type }) {
    const [moving] = this.filterGroups[type].splice(oldIndex, 1);
    this.filterGroups[type].splice(newIndex, 0, moving);
  }

  update({ type, filterGroup }) {
    const filterGroups = this.filterGroups[type];
    const index = filterGroups.findIndex(fg => fg.id === filterGroup.id);
    filterGroups[index] = Object.assign({}, filterGroups[index], filterGroup);
  }

  list() {
    return this.filterGroups;
  }
}

function connect({ name, protocol } = {}) {
  const conn = database.connect({
    name: name || 'filter-groups',
    protocol: protocol || config.data.protocol,
    Klass: FilterGroups,
    gcInterval: 0,
  });
  return conn.db;
}

module.exports = { connect };
