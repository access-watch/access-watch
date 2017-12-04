const fs = require('fs')

function read (name) {
  try {
    const path = './data/' + name + '.json'
    return JSON.parse(fs.readFileSync(path, 'utf-8'))
  } catch (err) {
    return null
  }
}

function write (name, content) {
  const path = './data/' + name + '.json'
  fs.writeFileSync(path, JSON.stringify(content), {encoding: 'utf-8'})
}

module.exports = {
  read: read,
  write: write
}
