const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Leaderboard = require('../../src/leaderboard/Leaderboard');

const TEST_FILE = path.join(__dirname, '../../data/test-leaderboard.json');

describe('Leaderboard', () => {
  let lb;

  beforeEach(() => {
    if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
    lb = new Leaderboard(TEST_FILE);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
  });

  it('starts with empty entries when file does not exist', () => {
    assert.deepStrictEqual(lb.getTop(), []);
  });

  it('adds and persists an entry', () => {
    lb.addEntry('Alice', 60000, 5);
    const entries = lb.getTop();
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].name, 'Alice');
    assert.strictEqual(entries[0].survivalMs, 60000);
    assert.strictEqual(entries[0].points, 5);

    // Verify persistence
    const lb2 = new Leaderboard(TEST_FILE);
    assert.strictEqual(lb2.getTop().length, 1);
  });

  it('sorts by survival time descending', () => {
    lb.addEntry('Alice', 30000, 2);
    lb.addEntry('Bob', 90000, 8);
    lb.addEntry('Charlie', 60000, 5);
    const top = lb.getTop();
    assert.strictEqual(top[0].name, 'Bob');
    assert.strictEqual(top[1].name, 'Charlie');
    assert.strictEqual(top[2].name, 'Alice');
  });

  it('limits entries to LEADERBOARD_SIZE', () => {
    for (let i = 0; i < 15; i++) {
      lb.addEntry(`Player${i}`, i * 10000, i);
    }
    assert.strictEqual(lb.getTop().length, 10);
    assert.strictEqual(lb.getTop()[0].survivalMs, 140000);
  });

  it('getTop(n) returns n entries', () => {
    for (let i = 0; i < 5; i++) {
      lb.addEntry(`P${i}`, i * 1000, i);
    }
    assert.strictEqual(lb.getTop(3).length, 3);
  });
});
