/**
 * Database of blocking and rate-limiting rules.
 *
 * A rule is a map with the following attributes:
 * id           string   a unique identifier
 * created      number   when the rule was created
 * conditions   List     the conditions to match
 * count        number   the number of events that match the rule since its creation
 * error        string   an error was thrown when trying to evaluate the rule
 *
 * If an error is thrown when applying the rule, the rule will be ignored for subsequent events.
 */
const Ajv = require('ajv')
const uuid = require('uuid/v4')
const fs = require('fs')
const { fromJS, Map } = require('immutable')
const { now } = require('./util')

const validator = new Ajv()

const matchers = Map({
  address: (data, log) => log.getIn(['address', 'value']) === data.get('address')
})

function matchCondition (data, log) {
  const type = data.get('type')
  if (matchers.has(type)) {
    const match = matchers.get(type)
    return match(data, log)
  } else {
    throw new Error('Unknown condition type: ' + type)
  }
}

const validators = Map({
  address: validator.compile({
    type: 'object',
    required: ['address'],
    properties: {
      address: {
        type: 'string'
      }
    }
  })
})

function validateCondition (condition) {
  if (validators.has(condition.type)) {
    const validate = validators.get(condition.type)
    if (!validate(condition)) {
      throw new Error(`Invalid condition: ${validator.errorsText(validate.errors)}`)
    }
  } else {
    throw new Error(`Unknown condition type: ${condition.type}`)
  }
}

function createRule (data) {
  return data
    .update('count', count => count || 0)
    .update('id', id => id || uuid())
    .update('created', created => created || now())
}

function matchRule (rule, log) {
  if (!rule.has('error')) {
    try {
      if (rule.get('conditions').every(c => matchCondition(c, log))) {
        return rule.update('count', 0, n => n + 1)
      }
    } catch (error) {
      console.trace(error)
      return rule.set('error', error.message)
    }
  }
  return rule
}

const validateRuleObject = validator.compile({
  type: 'object',
  required: ['conditions'],
  properties: {
    conditions: {
      type: 'array',
      items: { type: 'object' },
      minItems: 1
    }
  }
})

function validateRule (rule) {
  rule = rule.toJS()
  if (!validateRuleObject(rule)) {
    throw new Error(`Invalid rule: ${validator.errorsText(validateRuleObject.errors)}`)
  }
  rule.conditions.forEach(c => validateCondition(c))
}

class Database {
  constructor ({path}) {
    this.path = path
    try {
      fs.accessSync(path, fs.constants.F_OK)
      const data = fromJS(JSON.parse(fs.readFileSync(path)))
      this.rules = data.get('rules').map(data => createRule(data))
    } catch (err) {
      if (err.code === 'ENOENT') {
        // no rules file
        console.log('No rules file found. Creating a new database of rules.')
        this.rules = Map()
      } else {
        throw err
      }
    }
  }

  close () {
    fs.writeFileSync(this.path, JSON.stringify({rules: this.rules}, null, 2))
  }

  add (data) {
    const rule = createRule(data)
    validateRule(rule)
    this.rules = this.rules.set(rule.get('id'), rule)
  }

  get (id) {
    return this.rules.get(id)
  }

  remove (id) {
    this.rules = this.rules.remove(id)
  }

  list () {
    return this.rules
  }

  match (log) {
    this.rules = this.rules.map(rule => matchRule(rule, log))
  }
}

const databases = {}

function createDatabase (name, options) {
  if (databases[name]) {
    throw new Error('A database with the same name already exists.')
  }
  databases[name] = new Database(options)
  return databases[name]
}

module.exports = {
  createDatabase: (name, options) => createDatabase(name, options),
  getDatabase: (name) => databases[name]
}
