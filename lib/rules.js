/**
 * A database of blocking rules.
 */
const Ajv = require('ajv')
const uuid = require('uuid/v4')
const { fromJS, Map } = require('immutable')
const { now, iso } = require('./util')
const { Speed } = require('./speed')
const database = require('./database')

const ajv = new Ajv()

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
    return rule
      .update('speed', speed => {
        const time = new Date(log.get('time')).getTime() / 1000
        const attr = (log.getIn(['response', 'status']) === 403) ? 'blocked' : 'passed'
        return speed
          .updateIn([attr, 'per_minute'], speed => speed.hit(time))
          .updateIn([attr, 'per_hour'], speed => speed.hit(time))
      })
  }
  return rule
}

const validateCondition = (condition) => dispatchCondition(condition, validators)

function conditionValidator (f) {
  return condition => {
    if (!f(condition.toJS())) {
      throw new Error(`Invalid condition: ${ajv.errorsText(f.errors)}`)
    }
  }
}

const validators = Map({
  address: conditionValidator(ajv.compile({
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
    throw new Error(`Invalid rule: ${ajv.errorsText(validateRuleObject.errors)}`)
  }
  validateCondition(rule.get('condition'))
}

const validateRuleObject = ajv.compile({
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

function withSpeed (rule) {
  return rule
    .updateIn(['speed', 'blocked', 'per_minute'], speed => speed.compute())
    .updateIn(['speed', 'blocked', 'per_hour'], speed => speed.compute())
    .updateIn(['speed', 'passed', 'per_minute'], speed => speed.compute())
    .updateIn(['speed', 'passed', 'per_hour'], speed => speed.compute())
}

/**
 * Database of blocking rules.
 */
class Database {
  constructor () {
    this.rules = Map()
  }

  gc () {
    const cutoff = now() - 24 * 3600
    const oldCount = this.rules.size
    this.rules = this.rules.filter(rule => {
      return !rule.has('ttl') || (rule.get('created') + rule.get('ttl') >= cutoff)
    })
    console.log(`Garbage collected ${oldCount - this.rules.size} rules expired before ${iso(cutoff)}.`)
  }

  serialize () {
    return {
      rules: this.rules.toJS()
    }
  }

  static deserialize (data) {
    const db = new Database()
    if (data) {
      db.rules = fromJS(data.rules).map(rule => {
        return rule
          .updateIn(['speed', 'blocked', 'per_minute'], speed => Speed.deserialize(speed.toJS()))
          .updateIn(['speed', 'blocked', 'per_hour'], speed => Speed.deserialize(speed.toJS()))
          .updateIn(['speed', 'passed', 'per_minute'], speed => Speed.deserialize(speed.toJS()))
          .updateIn(['speed', 'passed', 'per_hour'], speed => Speed.deserialize(speed.toJS()))
      })
    }
    return db
  }

  // Add a rule to the database
  add (data) {
    const rule = data
          .setIn(['speed', 'blocked'], Map({
            per_minute: new Speed(60, 15),
            per_hour: new Speed(3600, 24)
          }))
          .setIn(['speed', 'passed'], Map({
            per_minute: new Speed(60, 15),
            per_hour: new Speed(3600, 24)
          }))
          .update('id', id => id || uuid())
          .set('created', now())
    validateRule(rule)
    this.rules = this.rules.set(rule.get('id'), rule)
  }

  // The rule with this identifier
  get (id) {
    return withSpeed(this.rules.get(id))
  }

  // Remove the rule with this identifier
  remove (id) {
    this.rules = this.rules.remove(id)
  }

  // All the rules in the database
  list () {
    return this.rules.map(withSpeed)
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

function connect (uri) {
  const conn = database.connect({
    uri: uri,
    Klass: Database,
    gcInterval: 3600 * 1000
  })
  return conn.db
}

module.exports = {
  connect: connect
}
