/**
 * Keep track of an entity's speed per fixed time windows.
 */
const { now } = require('./util');
const { Map, List, Range } = require('immutable');

class Speed {
  constructor(windowSize, size) {
    this.windowSize = windowSize;
    this.size = size;
    this.counters = Map();
    this.started = null;
  }

  // delete counters that are too old
  gc() {
    const cutoff = now() - this.size * this.windowSize;
    this.counters = this.counters.filter((c, t) => parseInt(t) > cutoff);
  }

  hit(time) {
    this.started = !this.started ? time : Math.min(this.started, time);
    const idx = time - (time % this.windowSize);
    this.counters = this.counters.update('' + idx, 0, n => n + 1);
    this.gc();
    return this;
  }

  compute() {
    this.gc();
    if (!this.started) {
      return List();
    }
    const time = now();
    return Range(0, this.size)
      .map(n => {
        let t = time - n * this.windowSize;
        t = t - (t % this.windowSize);
        if (t >= this.started - (this.started % this.windowSize)) {
          return this.counters.get('' + t, 0);
        }
      })
      .filter(v => v !== undefined);
  }

  serialize() {
    return {
      windowSize: this.windowSize,
      size: this.size,
      counters: this.counters.toJS(),
      started: this.started,
    };
  }

  static deserialize({ windowSize, size, counters, started }) {
    const speed = new Speed(windowSize, size);
    speed.counters = Map(counters);
    speed.started = started;
    speed.gc();
    return speed;
  }
}

module.exports = {
  Speed: Speed,
};
