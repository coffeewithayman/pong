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

describe('GameTimer - cumulative survival time', () => {
  let gm;
  let io;

  beforeEach(() => {
    io = createMockIO();
    gm = new GameManager(io);
  });

  afterEach(() => {
    gm.resetForTest();
  });

  it('champion accumulates survival time across multiple rounds', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });

    const s1 = createMockSocket('s1');
    const s2 = createMockSocket('s2');
    const s3 = createMockSocket('s3');
    io.addSocket(s1);
    io.addSocket(s2);
    io.addSocket(s3);

    // Two players join
    gm.handleJoin(s1, 'Alice');
    gm.handleJoin(s2, 'Bob');

    // Complete countdown (3 seconds)
    t.mock.timers.tick(3000);
    assert.strictEqual(gm.status, 'playing');

    // Simulate time passing by setting lastRoundStart in the past
    const now = Date.now();
    gm.playerLeft.lastRoundStart = now - 5000;
    gm.playerRight.lastRoundStart = now - 5000;

    // Alice (left) scores — stop loop first to prevent race
    gm.loop.stop();
    gm.onScore('left');

    // Alice's gameTimeMs should be ~5000ms (accumulated from completed round)
    assert.ok(gm.playerLeft.gameTimeMs >= 4900, `Expected gameTimeMs >= 4900, got ${gm.playerLeft.gameTimeMs}`);
    assert.strictEqual(gm.playerLeft.lastRoundStart, null);

    // Bob's eliminated survivalMs should be ~5000ms
    const bobElim = s2.getEmitted('eliminated');
    assert.strictEqual(bobElim.length, 1);
    assert.ok(bobElim[0].arguments[1].survivalMs >= 4900);

    // Wait for pause, Carol joins
    t.mock.timers.tick(C.SCORE_PAUSE_MS);
    gm.handleJoin(s3, 'Carol');
    assert.strictEqual(gm.status, 'countdown');

    // Complete countdown
    t.mock.timers.tick(3000);
    assert.strictEqual(gm.status, 'playing');

    // Simulate 3 more seconds of play
    const now2 = Date.now();
    gm.playerLeft.lastRoundStart = now2 - 3000;
    gm.playerRight.lastRoundStart = now2 - 3000;

    gm.loop.stop();
    gm.onScore('left');

    // Alice's total gameTimeMs should be ~8000ms (5000 + 3000)
    assert.ok(gm.playerLeft.gameTimeMs >= 7900, `Expected cumulative gameTimeMs >= 7900, got ${gm.playerLeft.gameTimeMs}`);

    // Carol's survivalMs should only be ~3000ms (just this round)
    const carolElim = s3.getEmitted('eliminated');
    assert.strictEqual(carolElim.length, 1);
    assert.ok(carolElim[0].arguments[1].survivalMs >= 2900);
    assert.ok(carolElim[0].arguments[1].survivalMs < 5000);
  });

  it('new challenger starts with 0 game time', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });

    const s1 = createMockSocket('s1');
    const s2 = createMockSocket('s2');
    const s3 = createMockSocket('s3');
    io.addSocket(s1);
    io.addSocket(s2);
    io.addSocket(s3);

    gm.handleJoin(s1, 'Alice');
    gm.handleJoin(s2, 'Bob');
    t.mock.timers.tick(3000);

    // Alice scores, Bob eliminated
    gm.onScore('left');
    t.mock.timers.tick(C.SCORE_PAUSE_MS);

    // Carol joins as new challenger
    gm.handleJoin(s3, 'Carol');
    assert.strictEqual(gm.playerRight.gameTimeMs, 0);
    assert.strictEqual(gm.playerRight.lastRoundStart, null);
  });

  it('disconnecting during countdown only counts completed round time', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });

    const s1 = createMockSocket('s1');
    const s2 = createMockSocket('s2');
    const s3 = createMockSocket('s3');
    io.addSocket(s1);
    io.addSocket(s2);
    io.addSocket(s3);

    gm.handleJoin(s1, 'Alice');
    gm.handleJoin(s2, 'Bob');
    t.mock.timers.tick(3000);
    assert.strictEqual(gm.status, 'playing');

    // Simulate 5 seconds of play by adjusting lastRoundStart
    const now = Date.now();
    gm.playerLeft.lastRoundStart = now - 5000;
    gm.playerRight.lastRoundStart = now - 5000;

    // Stop loop to prevent auto-scoring, then score manually
    gm.loop.stop();
    gm.onScore('left');

    // Alice won round 1, has ~5000ms accumulated
    assert.ok(gm.playerLeft.gameTimeMs >= 4900);
    assert.strictEqual(gm.playerLeft.lastRoundStart, null);

    // Carol joins after pause, countdown starts
    t.mock.timers.tick(C.SCORE_PAUSE_MS);
    gm.handleJoin(s3, 'Carol');
    assert.strictEqual(gm.status, 'countdown');

    // Advance 1 second into countdown, then Alice disconnects
    t.mock.timers.tick(1000);
    gm.handleDisconnect(s1);

    // Alice's leaderboard entry should only count the completed round time
    // (lastRoundStart is null during countdown, so no extra time added)
    const leaderboard = gm.leaderboard.getTop();
    const aliceEntry = leaderboard.find(e => e.name === 'Alice');
    assert.ok(aliceEntry, 'Alice should have a leaderboard entry');
    assert.ok(aliceEntry.survivalMs >= 4900, 'Alice survival time should be ~5000 (not counting countdown)');
    assert.ok(aliceEntry.survivalMs < 6000, 'Alice survival time should not include countdown time');
  });

  it('winner gameTimeMs accumulates after each round', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });

    const s1 = createMockSocket('s1');
    const s2 = createMockSocket('s2');
    io.addSocket(s1);
    io.addSocket(s2);

    gm.handleJoin(s1, 'Alice');
    gm.handleJoin(s2, 'Bob');
    t.mock.timers.tick(3000);

    // gameTimeMs is 0 before any score (time is tracked via lastRoundStart)
    assert.strictEqual(gm.playerLeft.gameTimeMs, 0);
    assert.ok(gm.playerLeft.lastRoundStart !== null);

    // Simulate 2 seconds of play
    const now = Date.now();
    gm.playerLeft.lastRoundStart = now - 2000;
    gm.playerRight.lastRoundStart = now - 2000;

    // Alice scores - stop loop to prevent race
    gm.loop.stop();
    gm.onScore('left');

    // After scoring, winner's time should be accumulated
    assert.ok(gm.playerLeft.gameTimeMs >= 1900, `gameTimeMs should be >= 1900, got ${gm.playerLeft.gameTimeMs}`);
    assert.strictEqual(gm.playerLeft.lastRoundStart, null);
    assert.strictEqual(gm.playerLeft.points, 1);
  });

  it('broadcastPlayerInfo includes timer fields', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });

    const s1 = createMockSocket('s1');
    const s2 = createMockSocket('s2');
    io.addSocket(s1);
    io.addSocket(s2);

    gm.handleJoin(s1, 'Alice');
    gm.handleJoin(s2, 'Bob');
    t.mock.timers.tick(3000);

    // Find the player-info emission
    const playerInfoCalls = io.roomEmit.mock.calls.filter(c => c.arguments[0] === 'player-info');
    assert.ok(playerInfoCalls.length > 0, 'Should have emitted player-info');

    const lastCall = playerInfoCalls[playerInfoCalls.length - 1];
    const info = lastCall.arguments[1];
    assert.ok('gameTimeMs' in info.left, 'left player info should include gameTimeMs');
    assert.ok('lastRoundStart' in info.left, 'left player info should include lastRoundStart');
    assert.ok('gameTimeMs' in info.right, 'right player info should include gameTimeMs');
    assert.ok('lastRoundStart' in info.right, 'right player info should include lastRoundStart');
  });

  it('getFullState includes timer fields', () => {
    const s1 = createMockSocket('s1');
    const s2 = createMockSocket('s2');
    io.addSocket(s1);
    io.addSocket(s2);

    gm.handleJoin(s1, 'Alice');
    gm.handleJoin(s2, 'Bob');

    const state = gm.getFullState();
    assert.ok('gameTimeMs' in state.playerInfo.left);
    assert.ok('lastRoundStart' in state.playerInfo.left);
    assert.ok('gameTimeMs' in state.playerInfo.right);
    assert.ok('lastRoundStart' in state.playerInfo.right);
  });
});
