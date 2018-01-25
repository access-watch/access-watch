const { Map } = require('immutable');
const { Speed } = require('./speed');
const { now } = require('./util');

const createSpeed = () => ({
  per_minute: new Speed(60, 15),
  per_hour: new Speed(3600, 24),
});

const createMonitoringItem = ({
  id,
  speeds,
  name,
  type,
  status = 'Not started',
}) => ({
  id,
  speeds: speeds.reduce(
    (acc, speedId) =>
      Object.assign(
        {
          [speedId]: createSpeed(),
        },
        acc
      ),
    {}
  ),
  name,
  type,
  hit(speedName = speeds[0], value = now()) {
    Object.values(this.speeds[speedName]).forEach(speed => {
      speed.hit(value);
    });
  },
  status,
  getComputed() {
    let computed = Map(this);
    Object.keys(this.speeds).forEach(speedName => {
      Object.keys(this.speeds[speedName]).forEach(speedId => {
        computed = computed.updateIn(['speeds', speedName, speedId], s =>
          s.compute()
        );
      });
    });
    return computed;
  },
});

class Monitoring {
  constructor() {
    this.items = {};
    this.currentId = 0;
  }

  register(monitoringData) {
    const id = this.currentId;
    this.items[id] = createMonitoringItem(
      Object.assign({ id }, monitoringData)
    );
    this.currentId++;
    return this.items[id];
  }

  registerOutput({ name, status }) {
    return this.register({
      name,
      status,
      speeds: ['processed'],
      type: 'output',
    });
  }

  get(id) {
    return this.items[id];
  }

  getAll(type) {
    return Object.values(this.items).filter(
      item => !type || item.type === type
    );
  }

  getAllComputed() {
    return Object.values(this.items).map(item => item.getComputed());
  }
}

module.exports = new Monitoring();
