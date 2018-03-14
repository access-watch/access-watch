/**
 * A database of blocking rules.
 */
const Ajv = require('ajv');
const uuid = require('uuid/v4');
const { fromJS, Map } = require('immutable');
const { now } = require('./util');
const { Speed } = require('./speed');
const database = require('./database');
const config = require('../constants');

const ajv = new Ajv();

// Dispatch the condition to the right method based on the condition's type.
function dispatchCondition(condition, methods, ...args) {
  const type = condition.get('type');
  if (methods.has(type)) {
    const method = methods.get(type);
    return method(condition, ...args);
  } else {
    throw new Error('Unknown condition type: ' + type);
  }
}

function isExpired(rule) {
  return rule.has('ttl') && now() > rule.get('started') + rule.get('ttl');
}

const matchCondition = (condition, log) =>
  dispatchCondition(condition, matchers, log);

const rulesMatchers = {
  address: ['address', 'value'],
  robot: ['robot', 'id'],
};

const matchers = Map({
  address: (condition, log) =>
    log.getIn(rulesMatchers.address, log.getIn(['request', 'address'])) ===
    condition.getIn(rulesMatchers.address),
  robot: (condition, log) =>
    log.getIn(rulesMatchers.robot, log.getIn(['request', 'robot'])) ===
    condition.getIn(rulesMatchers.robot),
});

function matchRule(rule, log) {
  if (!isExpired(rule) && matchCondition(rule.get('condition'), log)) {
    const time = new Date(log.getIn(['request', 'time'])).getTime() / 1000;
    const attr =
      log.getIn(['response', 'status']) === 403 ? 'blocked' : 'passed';
    return rule
      .update(
        'last_hit',
        previousHit => (previousHit ? Math.max(previousHit, time) : time)
      )
      .update(attr, speeds => {
        return speeds
          .update('per_minute', speed => speed.hit(time))
          .update('per_hour', speed => speed.hit(time));
      });
  }
  return rule;
}

const validateCondition = condition => dispatchCondition(condition, validators);

function conditionValidator(f) {
  return condition => {
    if (!f(condition.toJS())) {
      throw new Error(`Invalid condition: ${ajv.errorsText(f.errors)}`);
    }
  };
}

const validators = Map({
  address: conditionValidator(
    ajv.compile({
      type: 'object',
      required: ['address'],
      properties: {
        address: {
          type: 'object',
          required: ['value'],
          properties: {
            value: {
              type: 'string',
            },
          },
        },
      },
    })
  ),
  robot: conditionValidator(
    ajv.compile({
      type: 'object',
      required: ['robot'],
      properties: {
        robot: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
            },
          },
        },
      },
    })
  ),
});

function validateRule(rule) {
  if (!validateRuleObject(rule.toJS())) {
    throw new Error(
      `Invalid rule: ${ajv.errorsText(validateRuleObject.errors)}`
    );
  }
  validateCondition(rule.get('condition'));
}

const validateRuleObject = ajv.compile({
  type: 'object',
  required: ['condition', 'type'],
  properties: {
    condition: {
      type: 'object',
    },
    ttl: {
      type: 'number',
    },
    note: {
      type: 'string',
    },
    type: {
      type: 'string',
    },
  },
});

const getRobotComment = condition =>
  `# Blocked Robot: ${condition.getIn(['robot', 'name'])}\n`;

const getRobotCondition = addressTranslator => condition =>
  getRobotComment(condition) +
  condition
    .get('addresses')
    .map(addressTranslator)
    .join('\n');

const conditionToNginx = condition =>
  dispatchCondition(condition, nginxTranslators);

const addressNginxTranslator = condition =>
  `deny ${condition.getIn(['address', 'value'])};`;

const nginxTranslators = Map({
  address: addressNginxTranslator,
  robot: getRobotCondition(addressNginxTranslator),
});

function ruleToNginx(rule) {
  return conditionToNginx(rule.get('condition'));
}

const conditionToApache = condition =>
  dispatchCondition(condition, ApacheTranslators);

const addressApacheTranslator = condition =>
  `Require not ip ${condition.getIn(['address', 'value'])}`;

const ApacheTranslators = Map({
  address: addressApacheTranslator,
  robot: getRobotCondition(addressApacheTranslator),
});

function ruleToApache(rule) {
  return conditionToApache(rule.get('condition'));
}

const conditionToTxt = condition =>
  dispatchCondition(condition, TxtTranslators);

const addressTxtTranslator = condition => condition.getIn(['address', 'value']);

const TxtTranslators = Map({
  address: addressTxtTranslator,
  robot: condition =>
    condition
      .get('addresses')
      .map(addressTxtTranslator)
      .join('\n'),
});

function ruleToTxt(rule) {
  return conditionToTxt(rule.get('condition'));
}

function withSpeed(rule) {
  return rule
    .updateIn(['blocked', 'per_minute'], speed => speed.compute())
    .updateIn(['blocked', 'per_hour'], speed => speed.compute())
    .updateIn(['passed', 'per_minute'], speed => speed.compute())
    .updateIn(['passed', 'per_hour'], speed => speed.compute());
}

/**
 * Database of blocking rules.
 */
class Database {
  constructor() {
    this.rules = Map();
  }

  gc() {
    const cutoff = now() - config.rules.gc.expiration;
    this.rules = this.rules.filter(rule => {
      return (
        !rule.has('ttl') || rule.get('created') + rule.get('ttl') >= cutoff
      );
    });
  }

  setTransformExports(transformExports) {
    this.transformExports = transformExports;
  }

  serialize() {
    return {
      rules: this.rules.toJS(),
    };
  }

  static deserialize(data) {
    const db = new Database();
    if (data) {
      db.rules = fromJS(data.rules).map(rule => {
        return (
          rule
            .updateIn(['blocked', 'per_minute'], speed =>
              Speed.deserialize(speed.toJS())
            )
            .updateIn(['blocked', 'per_hour'], speed =>
              Speed.deserialize(speed.toJS())
            )
            .updateIn(['passed', 'per_minute'], speed =>
              Speed.deserialize(speed.toJS())
            )
            .updateIn(['passed', 'per_hour'], speed =>
              Speed.deserialize(speed.toJS())
            )
            // FIXME eventually remove this when we consider migration to rule type is conditionToApache
            .update('type', type => type || 'blocked')
        );
      });
    }
    return db;
  }

  // Add a rule to the database
  add(data) {
    const rule = data
      .set(
        'blocked',
        Map({
          per_minute: new Speed(60, 15),
          per_hour: new Speed(3600, 24),
        })
      )
      .set(
        'passed',
        Map({
          per_minute: new Speed(60, 15),
          per_hour: new Speed(3600, 24),
        })
      )
      .update('id', id => id || uuid())
      .set('created', now());
    validateRule(rule);
    this.rules = this.rules.set(rule.get('id'), rule);
    return rule;
  }

  // The rule with this identifier
  get(id) {
    return withSpeed(this.rules.get(id));
  }

  // Remove the rule with this identifier
  remove(id) {
    this.rules = this.rules.remove(id);
  }

  // All the rules in the database
  list(type) {
    if (type) {
      return this.rules
        .filter(rule => rule.get('type') === type)
        .map(withSpeed);
    }
    return this.rules.map(withSpeed);
  }

  // Match the log against all rules and update them
  match(log) {
    this.rules = this.rules.map(rule => matchRule(rule, log));
  }

  matchLog(log) {
    return this.rules.some(
      rule => !isExpired(rule) && matchCondition(rule.get('condition'), log)
    );
  }

  getSessionWithRule({ type, session }) {
    const getter = rulesMatchers[type];
    const rule = this.list()
      .filter(
        rule =>
          rule.getIn(['condition', 'type']) === type &&
          rule.get('condition').getIn(getter) === session.getIn(getter)
      )
      .first();
    if (rule) {
      return session.set('rule', rule);
    }
    return session;
  }

  groupByConditionType(type) {
    return this.list(type).reduce(
      (grouped, rule) =>
        grouped.update(rule.getIn(['condition', 'type']), (map = new Map()) =>
          map.set(rule.get('id'), rule)
        ),
      new Map()
    );
  }

  transformForExport(group, conditionType) {
    const transformFn =
      this.transformExports[conditionType] || (g => Promise.resolve(g));
    return transformFn(group);
  }

  getExport(type) {
    const transformPromises = this.groupByConditionType(type)
      .map((...args) => this.transformForExport(...args))
      .valueSeq();
    return Promise.all(transformPromises).then(groups =>
      groups.reduce((exported, group) => {
        return exported.merge(group);
      }, new Map())
    );
  }

  // Export database as Nginx configuration file
  toNginx(type) {
    return this.getExport(type).then(rules => {
      const nginxRules = rules.map(ruleToNginx).join('\n');
      return `# Blocked IPs
${nginxRules}`;
    });
  }

  // Export database as Apache configuration file
  toApache(type) {
    return this.getExport(type).then(rules => {
      const apacheRules = rules.map(ruleToApache).join('\n');
      return `<RequireAll>
  Require all granted
  # Blocked IPs
  ${apacheRules}
  </RequireAll>`;
    });
  }

  toTxt(type) {
    return this.getExport(type).then(rules => rules.map(ruleToTxt).join('\n'));
  }
}

function connect({ name, protocol } = {}) {
  const conn = database.connect({
    name: name || 'rules',
    protocol: protocol || config.data.protocol,
    Klass: Database,
    gcInterval: config.rules.gc.interval,
  });
  return conn.db;
}

module.exports = { connect, rulesMatchers };
