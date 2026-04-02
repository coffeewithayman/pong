class PlayerQueue {
  constructor() {
    this.queue = [];
  }

  enqueue(socketId, name) {
    if (this.queue.some((p) => p.socketId === socketId)) return;
    this.queue.push({ socketId, name, joinedAt: Date.now() });
  }

  dequeue() {
    return this.queue.shift() || null;
  }

  remove(socketId) {
    const idx = this.queue.findIndex((p) => p.socketId === socketId);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
      return true;
    }
    return false;
  }

  getPosition(socketId) {
    const idx = this.queue.findIndex((p) => p.socketId === socketId);
    return idx === -1 ? -1 : idx + 1;
  }

  size() {
    return this.queue.length;
  }

  getAll() {
    return [...this.queue];
  }

  has(socketId) {
    return this.queue.some((p) => p.socketId === socketId);
  }
}

module.exports = PlayerQueue;
