/**
 * Functions to manage the lifecycle of the databases.
 */
const path = require('path');
const fs = require('fs-extra');

const config = require('../constants');

// cache the connections by name
const connections = {};

class Connection {
  constructor(db, gcInterval) {
    this.db = db;
    this.gc = setInterval(() => {
      this.db.gc();
    }, gcInterval);
  }
  close() {
    clearInterval(this.gc);
    return Promise.resolve();
  }
}

/**
 * Connection to an in-memory database.
 */
class InMemoryConnection extends Connection {
  constructor(name, Klass, gcInterval) {
    super(new Klass(), gcInterval);
  }
}

/**
 * Return the JSON content of the file at `path`, or null.
 */
function readJSONFile(path) {
  try {
    return JSON.parse(fs.readFileSync(path));
  } catch (err) {
    if (err.code === 'ENOENT') {
      // file not found
      return null;
    } else {
      throw err;
    }
  }
}

/**
 * Write `data` in JSON in of the file at `path`
 */
function writeJSONFile(path, data) {
  return fs
    .writeJson(path + '.new', data)
    .then(() =>
      fs.pathExists(path).then(exists => {
        if (exists) fs.rename(path, path + '.previous');
      })
    )
    .then(() =>
      fs.pathExists(path + '.new').then(exists => {
        if (exists) fs.rename(path + '.new', path);
      })
    )
    .then(() =>
      fs.pathExists(path + '.previous').then(exists => {
        if (exists) fs.unlink(path + '.previous');
      })
    );
}

/**
 * Connection to a database stored on a file in the `data` directory.
 */
class FileConnection extends Connection {
  constructor(name, Klass, gcInterval) {
    const filePath = path.resolve(config.data.directory, name + '.json');
    const start = process.hrtime();
    const db = Klass.deserialize(readJSONFile(filePath));
    const elapsed = Math.round(process.hrtime(start)[1] / 1000000) / 1000;
    console.log(`Loaded ${filePath} in ${elapsed}s`);
    super(db, gcInterval);
    this.filePath = filePath;
    this.saveInterval = setInterval(
      () => this.save().catch(console.error),
      config.data.saveInterval
    );
  }

  save() {
    const data = this.db.serialize();
    const start = process.hrtime();
    return writeJSONFile(this.filePath, data).then(() => {
      const elapsed = Math.round(process.hrtime(start)[1] / 1000000) / 1000;
      console.log(`Saved ${this.filePath} in ${elapsed}s`);
    });
  }

  close() {
    clearInterval(this.saveInterval);
    return Promise.all([super.close(), this.save()]);
  }
}

/**
 * Connect to the store specified by `uri`.
 *
 * The `protocol` can be:
 *
 *  'memory'    In-memory store
 *  'file'      Filesystem store (`data` directory)
 */
function connect({ name, protocol, Klass, gcInterval }) {
  if (connections.hasOwnProperty(name)) {
    return connections[name];
  }
  let conn;
  switch (protocol) {
    case 'memory':
      conn = new InMemoryConnection(name, Klass, gcInterval);
      break;
    case 'file':
      conn = new FileConnection(name, Klass, gcInterval);
      break;
    default:
      throw new Error(`Unknown database protocol: ${protocol}`);
  }
  connections[name] = conn;
  return conn;
}

/**
 * Close all opened connections.
 *
 * Must be called when the process exits.
 */
function close() {
  const promises = [];
  for (var name in connections) {
    promises.push(connections[name].close());
    delete connections[name];
  }
  return Promise.all(promises);
}

module.exports = {
  connect: connect,
  close: close,
};
