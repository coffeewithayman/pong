const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const PlayerQueue = require('../../src/queue/PlayerQueue');

describe('PlayerQueue', () => {
  let queue;

  beforeEach(() => {
    queue = new PlayerQueue();
  });

  it('starts empty', () => {
    assert.strictEqual(queue.size(), 0);
  });

  it('enqueues players in FIFO order', () => {
    queue.enqueue('s1', 'Alice');
    queue.enqueue('s2', 'Bob');
    assert.strictEqual(queue.size(), 2);
    const first = queue.dequeue();
    assert.strictEqual(first.name, 'Alice');
    assert.strictEqual(first.socketId, 's1');
  });

  it('dequeue returns null when empty', () => {
    assert.strictEqual(queue.dequeue(), null);
  });

  it('prevents duplicate enqueue', () => {
    queue.enqueue('s1', 'Alice');
    queue.enqueue('s1', 'Alice');
    assert.strictEqual(queue.size(), 1);
  });

  it('removes by socketId', () => {
    queue.enqueue('s1', 'Alice');
    queue.enqueue('s2', 'Bob');
    assert.strictEqual(queue.remove('s1'), true);
    assert.strictEqual(queue.size(), 1);
    assert.strictEqual(queue.dequeue().name, 'Bob');
  });

  it('remove returns false for non-existent id', () => {
    assert.strictEqual(queue.remove('nope'), false);
  });

  it('tracks position (1-based)', () => {
    queue.enqueue('s1', 'Alice');
    queue.enqueue('s2', 'Bob');
    queue.enqueue('s3', 'Charlie');
    assert.strictEqual(queue.getPosition('s1'), 1);
    assert.strictEqual(queue.getPosition('s2'), 2);
    assert.strictEqual(queue.getPosition('s3'), 3);
    assert.strictEqual(queue.getPosition('s99'), -1);
  });

  it('has() checks membership', () => {
    queue.enqueue('s1', 'Alice');
    assert.strictEqual(queue.has('s1'), true);
    assert.strictEqual(queue.has('s2'), false);
  });

  it('getAll returns a copy', () => {
    queue.enqueue('s1', 'Alice');
    const all = queue.getAll();
    all.pop();
    assert.strictEqual(queue.size(), 1);
  });
});
