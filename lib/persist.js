const fs = require('fs')

/**
 * Persist an object as a JSON file.
 *
 * The object must implement the following methods:
 *   load(data)   load the JSON data in the object
 *   unload()     return the JSON data to write to the filesystem
 */
class PersistentObject {
  constructor (name, object) {
    this.name = name
    this.object = object
  }

  path () {
    return './data/' + this.name + '.json'
  }

  read () {
    let data
    try {
      data = JSON.parse(fs.readFileSync(this.path(), 'utf-8'))
    } catch (err) {
      data = null
    }
    this.object.load(data)
  }

  write () {
    const data = this.object.unload()
    fs.writeFileSync(this.path(), JSON.stringify(data), {encoding: 'utf-8'})
  }
}

module.exports = {
  PersistentObject: PersistentObject
}
