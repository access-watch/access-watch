/**
 * Functions to manage the lifecycle of the databases.
 */
const path = require('path');
const fs = require('fs');

const config = require('../config/constants');

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
 * Write the Javascript value as a JSON file at `path`.
 */
function writeJSONFile(path, value) {
  fs.writeFileSync(path, JSON.stringify(value, null, 2));
}

/**
 * Connection to a database stored on a file in the `data` directory.
 */
class FileConnection extends Connection {
  constructor(name, Klass, gcInterval) {
    const filePath = path.resolve(config.data.directory, name + '.json');
    super(Klass.deserialize(readJSONFile(filePath)), gcInterval);
    this.filePath = filePath;
  }

  close() {
    super.close();
    writeJSONFile(this.filePath, this.db.serialize());
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
  for (var name in connections) {
    connections[name].close();
    delete connections[name];
  }
}

module.exports = {
  connect: connect,
  close: close,
};
