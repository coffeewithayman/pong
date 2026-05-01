const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const GameManager = require('../../src/game/GameManager');
const C = require('../../src/game/constants');

// Create a mock socket
function createMockSocket(id) {
  const listeners = {};
  return {
    id,
    join: mock.fn(),
    emit: mock.fn(),
    on(event, fn) { listeners[event] = fn; },
    listeners,
    getEmitted(event) {
      return this.emit.mock.calls.filter(c => c.arguments[0] === event);
    },
  };
}

// Create a mock IO object
function createMockIO() {
  const sockets = new Map();
  const roomEmit = mock.fn();
  return {
    sockets: { sockets },
    to: mock.fn(() => ({ emit: roomEmit })),
    roomEmit,
    addSocket(socket) {
      sockets.set(socket.id, socket);
    },
  };
}

describe('GameManager', () => {
  let gm;
  let io;

  beforeEach(() => {
    io = createMockIO();
    gm = new GameManager(io);
  });

  afterEach(() => {
    gm.resetForTest();
  });

  describe('handleJoin', () => {
    it('assigns first player to left slot', () => {
      const s1 = createMockSocket('s1');
      io.addSocket(s1);
      gm.handleJoin(s1, 'Alice');
      assert.strictEqual(gm.playerLeft.name, 'Alice');
      assert.strictEqual(gm.playerLeft.socketId, 's1');
      assert.strictEqual(gm.playerRight, null);
      assert.strictEqual(gm.status, 'waiting');
    });

    it('assigns second player to right slot and starts countdown', () => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      io.addSocket(s1);
      io.addSocket(s2);
      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      assert.strictEqual(gm.playerLeft.name, 'Alice');
      assert.strictEqual(gm.playerRight.name, 'Bob');
      assert.strictEqual(gm.status, 'countdown');
    });

    it('queues third player when both slots are full', () => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      const s3 = createMockSocket('s3');
      io.addSocket(s1);
      io.addSocket(s2);
      io.addSocket(s3);
      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      gm.handleJoin(s3, 'Carol');
      assert.strictEqual(gm.queue.size(), 1);
      const queued = s3.getEmitted('queued');
      assert.strictEqual(queued.length, 1);
      assert.strictEqual(queued[0].arguments[1].position, 1);
    });
  });

  describe('race condition: rejoin during pause', () => {
    it('does not call startCountdown twice when player rejoins during pause', (t) => {
      // Use fake timers
      t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });

      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      io.addSocket(s1);
      io.addSocket(s2);

      // Two players join and game starts
      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      assert.strictEqual(gm.status, 'countdown');

      // Complete countdown
      t.mock.timers.tick(3000);
      assert.strictEqual(gm.status, 'playing');

      // Left scores → right (Bob) eliminated
      gm.onScore('left');
      assert.strictEqual(gm.status, 'paused');
      assert.strictEqual(gm.playerRight, null);

      // Bob was eliminated — verify
      const eliminated = s2.getEmitted('eliminated');
      assert.strictEqual(eliminated.length, 1);

      // Bob rejoins DURING the pause (before pauseTimeout fires)
      gm.handleJoin(s2, 'Bob');
      assert.strictEqual(gm.playerRight.name, 'Bob');
      assert.strictEqual(gm.status, 'countdown');

      // The pauseTimeout should have been cancelled by startCountdown
      // Advance past the original pause time — should NOT cause another startCountdown
      t.mock.timers.tick(C.SCORE_PAUSE_MS);

      // Still in countdown (not reset by a second startCountdown call)
      assert.strictEqual(gm.status, 'countdown');

      // Complete the countdown
      t.mock.timers.tick(3000);
      assert.strictEqual(gm.status, 'playing');

      // Game should be running normally — no double intervals
      // Force a score to verify the game state is clean
      gm.onScore('left');
      assert.strictEqual(gm.status, 'paused');

      // Bob should be eliminated exactly once more (2 total)
      const allEliminated = s2.getEmitted('eliminated');
      assert.strictEqual(allEliminated.length, 2);
    });

    it('does not leave game in broken state after score-rejoin-score cycle', (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });

      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      const s3 = createMockSocket('s3');
      io.addSocket(s1);
      io.addSocket(s2);
      io.addSocket(s3);

      // Two players join and play
      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      t.mock.timers.tick(3000); // countdown
      assert.strictEqual(gm.status, 'playing');

      // Alice scores, Bob eliminated
      gm.onScore('left');
      assert.strictEqual(gm.playerRight, null);

      // Wait for pause to complete, fillSlots runs
      t.mock.timers.tick(C.SCORE_PAUSE_MS);
      assert.strictEqual(gm.status, 'waiting');

      // New player Carol joins
      gm.handleJoin(s3, 'Carol');
      assert.strictEqual(gm.playerRight.name, 'Carol');
      assert.strictEqual(gm.status, 'countdown');

      // Complete countdown and play
      t.mock.timers.tick(3000);
      assert.strictEqual(gm.status, 'playing');

      // Alice scores again
      gm.onScore('left');
      const carolElim = s3.getEmitted('eliminated');
      assert.strictEqual(carolElim.length, 1);
      assert.strictEqual(gm.status, 'paused');
    });
  });

  describe('handleDisconnect', () => {
    it('handles disconnect during countdown cleanly', (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });

      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      const s3 = createMockSocket('s3');
      io.addSocket(s1);
      io.addSocket(s2);
      io.addSocket(s3);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      assert.strictEqual(gm.status, 'countdown');

      // Bob disconnects during countdown
      gm.handleDisconnect(s2);
      assert.strictEqual(gm.playerRight, null);
      assert.strictEqual(gm.countdownTimeout, null);

      // Wait for pause
      t.mock.timers.tick(C.SCORE_PAUSE_MS);

      // Only Alice left, status should be waiting
      assert.strictEqual(gm.playerLeft.name, 'Alice');
      assert.strictEqual(gm.status, 'waiting');

      // Carol joins — game should start normally
      gm.handleJoin(s3, 'Carol');
      assert.strictEqual(gm.playerRight.name, 'Carol');
      assert.strictEqual(gm.status, 'countdown');

      t.mock.timers.tick(3000);
      assert.strictEqual(gm.status, 'playing');
    });

    it('stores pauseTimeout so it can be cancelled on next join', (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });

      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      io.addSocket(s1);
      io.addSocket(s2);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      t.mock.timers.tick(3000); // countdown
      assert.strictEqual(gm.status, 'playing');

      // Bob disconnects during game
      gm.handleDisconnect(s2);
      // pauseTimeout should be stored (not null yet, since it hasn't fired)
      assert.ok(gm.pauseTimeout !== null, 'pauseTimeout should be set after disconnect');

      // New player joins before pause completes
      const s3 = createMockSocket('s3');
      io.addSocket(s3);
      gm.handleJoin(s3, 'Carol');
      assert.strictEqual(gm.status, 'countdown');

      // pauseTimeout should have been cancelled by startCountdown
      assert.strictEqual(gm.pauseTimeout, null, 'pauseTimeout should be cancelled');

      // Advance past original pause — should not interfere
      t.mock.timers.tick(C.SCORE_PAUSE_MS);
      assert.strictEqual(gm.status, 'countdown');

      t.mock.timers.tick(3000);
      assert.strictEqual(gm.status, 'playing');
    });
  });

  describe('fillSlots', () => {
    it('keeps winner on their current side after elimination', (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });

      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      io.addSocket(s1);
      io.addSocket(s2);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      t.mock.timers.tick(3000);

      // Right (Bob) scores → left (Alice) eliminated
      gm.onScore('right');
      t.mock.timers.tick(C.SCORE_PAUSE_MS);

      // Bob should stay on the right side
      assert.strictEqual(gm.playerLeft, null);
      assert.strictEqual(gm.playerRight.name, 'Bob');
      assert.strictEqual(gm.status, 'waiting');
    });

    it('fills from queue after elimination', (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });

      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      const s3 = createMockSocket('s3');
      io.addSocket(s1);
      io.addSocket(s2);
      io.addSocket(s3);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      gm.handleJoin(s3, 'Carol');
      assert.strictEqual(gm.queue.size(), 1);

      t.mock.timers.tick(3000);

      // Left scores → Bob eliminated
      gm.onScore('left');
      t.mock.timers.tick(C.SCORE_PAUSE_MS);

      // Carol should have been dequeued to right slot
      assert.strictEqual(gm.playerLeft.name, 'Alice');
      assert.strictEqual(gm.playerRight.name, 'Carol');
      assert.strictEqual(gm.queue.size(), 0);
      assert.strictEqual(gm.status, 'countdown');
    });
  });
});
