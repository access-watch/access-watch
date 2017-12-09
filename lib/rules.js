/**
 * A database of blocking rules.
 */
const Ajv = require('ajv')
const uuid = require('uuid/v4')
const fs = require('fs')
const { fromJS, Map } = require('immutable')
const { now } = require('./util')

const validator = new Ajv()

// Dispatch the condition to the right method based on the condition's type.
function dispatchCondition (condition, methods, ...args) {
  const type = condition.get('type')
  if (methods.has(type)) {
    const method = methods.get(type)
    return method(condition, ...args)
  } else {
    throw new Error('Unknown condition type: ' + type)
  }
}

function isExpired (rule) {
  return rule.has('ttl') && now() > rule.get('started') + rule.get('ttl')
}

const matchCondition = (condition, log) => dispatchCondition(condition, matchers, log)

const matchers = Map({
  address: (condition, log) => log.getIn(['address', 'value']) === condition.getIn(['address', 'value'])
})

function matchRule (rule, log) {
  if (!isExpired(rule) && matchCondition(rule.get('condition'), log)) {
    return rule.update('count', 0, n => n + 1)
  }
  return rule
}

const validateCondition = (condition) => dispatchCondition(condition, validators)

function conditionValidator (validator) {
  return condition => {
    if (!validator(condition.toJS())) {
      throw new Error(`Invalid condition: ${validator.errorsText(validator.errors)}`)
    }
  }
}

const validators = Map({
  address: conditionValidator(validator.compile({
    type: 'object',
    required: ['address'],
    properties: {
      address: {
        type: 'object',
        required: ['value'],
        properties: {
          value: {
            type: 'string'
          }
        }
      }
    }
  }))
})

function validateRule (rule) {
  if (!validateRuleObject(rule.toJS())) {
    throw new Error(`Invalid rule: ${validator.errorsText(validateRuleObject.errors)}`)
  }
  validateCondition(rule.get('condition'))
}

const validateRuleObject = validator.compile({
  type: 'object',
  required: ['condition'],
  properties: {
    condition: {
      type: 'object'
    },
    ttl: {
      type: 'number'
    },
    note: {
      type: 'string'
    }
  }
})

/**
 * Database of blocking rules.
 */
class Database {
  constructor ({path}) {
    this.path = path
    try {
      fs.accessSync(path, fs.constants.F_OK)
      this.rules = fromJS(JSON.parse(fs.readFileSync(path))).get('rules')
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

  // Add a rule to the database
  add (data) {
    const rule = data
          .update('count', count => count || 0)
          .update('id', id => id || uuid())
          .update('created', created => created || now())
    validateRule(rule)
    this.rules = this.rules.set(rule.get('id'), rule)
  }

  // The rule with this identifier
  get (id) {
    return this.rules.get(id)
  }

  // Remove the rule with this identifier
  remove (id) {
    this.rules = this.rules.remove(id)
  }

  // All the rules in the database
  list () {
    return this.rules
  }

  // Match the log against all rules and update them
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
