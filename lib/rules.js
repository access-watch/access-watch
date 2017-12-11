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

const conditionToNginx = (condition) => dispatchCondition(condition, nginxTranslators)

const nginxTranslators = Map({
  address: (condition) => `deny ${condition.getIn(['address', 'value'])}`
})

function ruleToNginx (rule) {
  return conditionToNginx(rule.get('condition'))
}

function gc (rules) {
  const cutoff = now() - 24 * 3600
  console.log('Garbage collecting rules that expired more than 24 hours ago.')
  console.log(`${rules.size} rules in the database.`)
  rules = rules.filter(rule => {
    return !rule.has('ttl') || (rule.get('created') + rule.get('ttl') >= cutoff)
  })
  console.log(`${rules.size} rules in the database after garbage collection.`)
  return rules
}

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
    this.gc = setInterval(function () {
      this.rules = gc(this.rules)
    }.bind(this), 3600 * 1000)
  }

  close () {
    fs.writeFileSync(this.path, JSON.stringify({rules: this.rules}, null, 2))
    clearInterval(this.gc)
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

  // Export database as Nginx configuration file
  toNginx () {
    return this.list()
      .map(ruleToNginx)
      .join('\n')
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
