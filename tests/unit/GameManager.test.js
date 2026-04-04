const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const GameManager = require('../../src/game/GameManager');
const C = require('../../src/game/constants');

// Helper to create a mock Socket.IO setup
function createMockIO() {
  const sockets = new Map();
  const roomEvents = {};

  const io = {
    sockets: { sockets },
    to: (room) => ({
      emit: (event, data) => {
        if (!roomEvents[event]) roomEvents[event] = [];
        roomEvents[event].push(data);
      },
    }),
    _roomEvents: roomEvents,
  };

  return io;
}

function createMockSocket(id) {
  const events = {};
  return {
    id,
    join: () => {},
    emit: (event, data) => {
      if (!events[event]) events[event] = [];
      events[event].push(data);
    },
    _events: events,
  };
}

function registerSocket(io, socket) {
  io.sockets.sockets.set(socket.id, socket);
}

describe('GameManager', () => {
  let io, gm;

  beforeEach(() => {
    io = createMockIO();
    gm = new GameManager(io);
    // Suppress log output during tests
    gm.log = () => {};
  });

  afterEach(() => {
    gm.loop.stop();
    gm.clearPauseTimeout();
  });

  describe('handleJoin', () => {
    it('assigns first player to left slot', () => {
      const s1 = createMockSocket('s1');
      registerSocket(io, s1);

      gm.handleJoin(s1, 'Alice');
      assert.strictEqual(gm.playerLeft.name, 'Alice');
      assert.strictEqual(gm.playerLeft.socketId, 's1');
      assert.strictEqual(gm.playerRight, null);
      assert.deepStrictEqual(s1._events['your-turn'], [{ side: 'left' }]);
    });

    it('assigns second player to right slot and starts game', () => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      registerSocket(io, s1);
      registerSocket(io, s2);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');

      assert.strictEqual(gm.playerLeft.name, 'Alice');
      assert.strictEqual(gm.playerRight.name, 'Bob');
      assert.strictEqual(gm.status, 'playing');
      assert.strictEqual(gm.loop.running, true);
    });

    it('queues third player when both slots are full', () => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      const s3 = createMockSocket('s3');
      registerSocket(io, s1);
      registerSocket(io, s2);
      registerSocket(io, s3);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      gm.handleJoin(s3, 'Charlie');

      assert.strictEqual(gm.queue.size(), 1);
      assert.deepStrictEqual(s3._events['queued'], [{ position: 1, total: 1 }]);
    });

    it('prevents duplicate join from same socket', () => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      registerSocket(io, s1);
      registerSocket(io, s2);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');

      // Alice tries to join again while already in left slot
      gm.handleJoin(s1, 'Alice');

      // Alice should still be in left, Bob in right, no queue
      assert.strictEqual(gm.playerLeft.socketId, 's1');
      assert.strictEqual(gm.playerRight.socketId, 's2');
      assert.strictEqual(gm.queue.size(), 0);
    });

    it('prevents join from socket already in queue', () => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      const s3 = createMockSocket('s3');
      registerSocket(io, s1);
      registerSocket(io, s2);
      registerSocket(io, s3);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      gm.handleJoin(s3, 'Charlie');

      // Charlie tries to join again
      gm.handleJoin(s3, 'Charlie');

      assert.strictEqual(gm.queue.size(), 1);
    });
  });

  describe('onScore', () => {
    it('eliminates the right player when left scores', () => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      registerSocket(io, s1);
      registerSocket(io, s2);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      gm.loop.stop();

      gm.onScore('left');

      assert.strictEqual(gm.playerLeft.name, 'Alice');
      assert.strictEqual(gm.playerRight, null);
      assert.strictEqual(gm.status, 'paused');
      assert.deepStrictEqual(s2._events['eliminated'][0].points, 0);
    });

    it('eliminates the left player when right scores', () => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      registerSocket(io, s1);
      registerSocket(io, s2);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      gm.loop.stop();

      gm.onScore('right');

      assert.strictEqual(gm.playerLeft, null);
      assert.strictEqual(gm.playerRight.name, 'Bob');
      assert.strictEqual(gm.status, 'paused');
      assert.deepStrictEqual(s1._events['eliminated'][0].points, 0);
    });

    it('increments winner points', () => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      registerSocket(io, s1);
      registerSocket(io, s2);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      gm.loop.stop();

      gm.onScore('left');

      assert.strictEqual(gm.playerLeft.points, 1);
    });
  });

  describe('fillSlots', () => {
    it('promotes right player to left when left is empty', () => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      registerSocket(io, s1);
      registerSocket(io, s2);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      gm.loop.stop();

      // Simulate left player eliminated
      gm.playerLeft = null;
      gm.fillSlots();

      assert.strictEqual(gm.playerLeft.name, 'Bob');
      assert.strictEqual(gm.playerLeft.socketId, 's2');
      assert.strictEqual(gm.playerRight, null);
      assert.deepStrictEqual(s2._events['side-change'], [{ side: 'left' }]);
    });

    it('dequeues player into right slot after promotion', () => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      const s3 = createMockSocket('s3');
      registerSocket(io, s1);
      registerSocket(io, s2);
      registerSocket(io, s3);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      gm.handleJoin(s3, 'Charlie');
      gm.loop.stop();

      // Simulate left player eliminated
      gm.playerLeft = null;
      gm.fillSlots();

      // Bob promoted to left, Charlie dequeued to right
      assert.strictEqual(gm.playerLeft.name, 'Bob');
      assert.strictEqual(gm.playerRight.name, 'Charlie');
      assert.strictEqual(gm.status, 'playing');
    });
  });

  describe('handleDisconnect', () => {
    it('removes player from queue on disconnect', () => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      const s3 = createMockSocket('s3');
      registerSocket(io, s1);
      registerSocket(io, s2);
      registerSocket(io, s3);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      gm.handleJoin(s3, 'Charlie');

      gm.handleDisconnect(s3);
      assert.strictEqual(gm.queue.size(), 0);
    });

    it('handles left player disconnect during game', () => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      registerSocket(io, s1);
      registerSocket(io, s2);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');

      gm.handleDisconnect(s1);
      assert.strictEqual(gm.playerLeft, null);
      assert.strictEqual(gm.loop.running, false);
    });

    it('saves timeout to pauseTimeout so it can be cancelled', () => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      registerSocket(io, s1);
      registerSocket(io, s2);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');

      gm.handleDisconnect(s1);
      assert.notStrictEqual(gm.pauseTimeout, null, 'pauseTimeout should be set after disconnect');
    });
  });

  describe('race conditions', () => {
    it('cancels pauseTimeout when new player joins during pause', (t, done) => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      const s3 = createMockSocket('s3');
      registerSocket(io, s1);
      registerSocket(io, s2);
      registerSocket(io, s3);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      gm.loop.stop();

      // Score: left scores, right (Bob) eliminated
      gm.onScore('left');
      assert.strictEqual(gm.status, 'paused');
      assert.notStrictEqual(gm.pauseTimeout, null);

      // Bob rejoins during pause period
      gm.handleJoin(s3, 'Charlie');

      // pauseTimeout should be cancelled since startGame was called
      assert.strictEqual(gm.pauseTimeout, null, 'pauseTimeout should be cleared after new player joins and starts game');
      assert.strictEqual(gm.status, 'playing');

      // Wait for what would have been the timeout period to verify no stale fillSlots fires
      gm.loop.stop();
      setTimeout(() => {
        // Status should still be whatever it is, not reset by a stale fillSlots
        assert.strictEqual(gm.playerLeft.name, 'Alice');
        assert.strictEqual(gm.playerRight.name, 'Charlie');
        done();
      }, C.SCORE_PAUSE_MS + 100);
    });

    it('handles both players disconnecting then new players joining', (t, done) => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      registerSocket(io, s1);
      registerSocket(io, s2);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      gm.loop.stop();

      // Score: right eliminated
      gm.onScore('left');

      // Both disconnect
      gm.handleDisconnect(s2); // Bob already eliminated, this is a no-op for slots
      gm.handleDisconnect(s1); // Alice disconnects

      assert.strictEqual(gm.playerLeft, null);
      assert.strictEqual(gm.playerRight, null);

      // Wait for timeouts to settle
      setTimeout(() => {
        // Now new players join
        const s3 = createMockSocket('s3');
        const s4 = createMockSocket('s4');
        registerSocket(io, s3);
        registerSocket(io, s4);

        gm.handleJoin(s3, 'Charlie');
        assert.strictEqual(gm.playerLeft.name, 'Charlie');
        assert.strictEqual(gm.status, 'waiting');

        gm.handleJoin(s4, 'Diana');
        assert.strictEqual(gm.playerRight.name, 'Diana');
        assert.strictEqual(gm.status, 'playing');

        // New players should NOT receive eliminated events
        assert.strictEqual(s3._events['eliminated'], undefined, 'Charlie should not receive eliminated event');
        assert.strictEqual(s4._events['eliminated'], undefined, 'Diana should not receive eliminated event');

        gm.loop.stop();
        done();
      }, C.SCORE_PAUSE_MS + 200);
    });

    it('handles player rejoining after elimination', () => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      registerSocket(io, s1);
      registerSocket(io, s2);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      gm.loop.stop();

      // Bob eliminated
      gm.onScore('left');
      assert.ok(s2._events['eliminated'], 'Bob should be eliminated');

      // Bob rejoins (simulating "Play Again" button)
      gm.handleJoin(s2, 'Bob');

      assert.strictEqual(gm.playerLeft.name, 'Alice');
      assert.strictEqual(gm.playerRight.name, 'Bob');
      assert.strictEqual(gm.status, 'playing');

      gm.loop.stop();
    });

    it('handles multiple score-rejoin cycles without breaking', () => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      registerSocket(io, s1);
      registerSocket(io, s2);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      gm.loop.stop();

      // Cycle 1: Bob eliminated, rejoins
      gm.onScore('left');
      gm.handleJoin(s2, 'Bob');
      gm.loop.stop();

      // Cycle 2: Alice eliminated, rejoins
      gm.onScore('right');
      gm.handleJoin(s1, 'Alice');
      gm.loop.stop();

      // Cycle 3: Bob eliminated, rejoins
      gm.onScore('left');
      gm.handleJoin(s2, 'Bob');
      gm.loop.stop();

      assert.strictEqual(gm.playerLeft.name, 'Alice');
      assert.strictEqual(gm.playerRight.name, 'Bob');

      // Check no double-eliminated events beyond 1 per cycle
      const bobEliminations = s2._events['eliminated'];
      assert.strictEqual(bobEliminations.length, 2, 'Bob should have been eliminated exactly twice');

      const aliceEliminations = s1._events['eliminated'];
      assert.strictEqual(aliceEliminations.length, 1, 'Alice should have been eliminated exactly once');
    });

    it('does not double-start game when fillSlots and handleJoin race', (t, done) => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      const s3 = createMockSocket('s3');
      registerSocket(io, s1);
      registerSocket(io, s2);
      registerSocket(io, s3);

      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      gm.loop.stop();

      // Right player disconnects during game
      gm.handleDisconnect(s2);
      assert.strictEqual(gm.playerRight, null);
      assert.notStrictEqual(gm.pauseTimeout, null);

      // New player joins during pause (before fillSlots fires)
      gm.handleJoin(s3, 'Charlie');
      assert.strictEqual(gm.playerRight.name, 'Charlie');
      assert.strictEqual(gm.status, 'playing');
      assert.strictEqual(gm.pauseTimeout, null, 'pauseTimeout should be cleared');

      gm.loop.stop();

      // Wait for what would have been the timeout
      setTimeout(() => {
        // Game state should be clean
        assert.strictEqual(gm.playerLeft.name, 'Alice');
        assert.strictEqual(gm.playerRight.name, 'Charlie');
        done();
      }, C.SCORE_PAUSE_MS + 100);
    });

    it('full lifecycle: play, score, leave, new players join fresh', (t, done) => {
      const s1 = createMockSocket('s1');
      const s2 = createMockSocket('s2');
      registerSocket(io, s1);
      registerSocket(io, s2);

      // Game 1: Alice vs Bob
      gm.handleJoin(s1, 'Alice');
      gm.handleJoin(s2, 'Bob');
      gm.loop.stop();
      assert.strictEqual(gm.status, 'playing');

      // Left scores, Bob eliminated
      gm.onScore('left');
      assert.strictEqual(gm.status, 'paused');

      // Both leave
      gm.handleDisconnect(s1);
      gm.handleDisconnect(s2);
      assert.strictEqual(gm.playerLeft, null);
      assert.strictEqual(gm.playerRight, null);

      // Wait for all timeouts to settle
      setTimeout(() => {
        assert.strictEqual(gm.status, 'waiting');

        // New players join
        const s3 = createMockSocket('s3');
        const s4 = createMockSocket('s4');
        registerSocket(io, s3);
        registerSocket(io, s4);

        gm.handleJoin(s3, 'Eve');
        assert.strictEqual(gm.playerLeft.name, 'Eve');
        assert.strictEqual(gm.status, 'waiting');
        assert.strictEqual(s3._events['eliminated'], undefined);

        gm.handleJoin(s4, 'Frank');
        assert.strictEqual(gm.playerRight.name, 'Frank');
        assert.strictEqual(gm.status, 'playing');
        assert.strictEqual(s4._events['eliminated'], undefined);

        // Let the game run a few ticks to verify no immediate scoring
        let tickCount = 0;
        let someoneEliminated = false;

        const origOnScore = gm.onScore.bind(gm);
        gm.onScore = function (side) {
          someoneEliminated = true;
          origOnScore(side);
        };

        // Run 60 ticks (1 second of game time) manually
        for (let i = 0; i < 60; i++) {
          const result = gm.engine.tick(0, 0);
          if (result.scored) {
            someoneEliminated = true;
          }
          tickCount++;
        }

        assert.strictEqual(someoneEliminated, false, 'No one should be eliminated within the first second of play');
        gm.loop.stop();
        done();
      }, C.SCORE_PAUSE_MS * 2 + 200);
    });
  });
});
