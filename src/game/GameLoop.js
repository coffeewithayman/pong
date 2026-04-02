const C = require('./constants');

class GameLoop {
  constructor(engine, onTick) {
    this.engine = engine;
    this.onTick = onTick;
    this.intervalId = null;
    this.leftInput = 0;
    this.rightInput = 0;
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.intervalId = setInterval(() => {
      const result = this.engine.tick(this.leftInput, this.rightInput);
      this.onTick(result);
    }, C.TICK_INTERVAL);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  setInput(side, direction) {
    if (side === 'left') this.leftInput = direction;
    else if (side === 'right') this.rightInput = direction;
  }

  resetInputs() {
    this.leftInput = 0;
    this.rightInput = 0;
  }
}

module.exports = GameLoop;
