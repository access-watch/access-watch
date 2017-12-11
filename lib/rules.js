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
const { fromJS, Map } = require('immutable')
const { now } = require('./util')
const database = require('./database')

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
  constructor () {
    this.rules = Map()
  }

  serialize () {
    return {
      rules: this.rules.toJS()
    }
  }

  static deserialize (data) {
    const db = new Database()
    if (data) {
      this.rules = fromJS(data.rules)
    }
    return db
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

module.exports = {
  connect: (uri) => database.connect(uri, Database).db
}
