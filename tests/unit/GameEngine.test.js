const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const GameEngine = require('../../src/game/GameEngine');
const C = require('../../src/game/constants');

describe('GameEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new GameEngine();
  });

  describe('reset', () => {
    it('centers the ball', () => {
      engine.reset();
      assert.strictEqual(engine.ball.x, C.CANVAS_WIDTH / 2);
      assert.strictEqual(engine.ball.y, C.CANVAS_HEIGHT / 2);
    });

    it('centers both paddles', () => {
      engine.reset();
      const expected = (C.CANVAS_HEIGHT - C.PADDLE_HEIGHT) / 2;
      assert.strictEqual(engine.paddleLeft.y, expected);
      assert.strictEqual(engine.paddleRight.y, expected);
    });

    it('gives the ball a non-zero velocity', () => {
      engine.reset();
      assert.ok(engine.ball.vx !== 0 || engine.ball.vy !== 0);
    });
  });

  describe('tick - ball movement', () => {
    it('moves the ball by its velocity each tick', () => {
      engine.ball.vx = 3;
      engine.ball.vy = 2;
      const prevX = engine.ball.x;
      const prevY = engine.ball.y;
      engine.tick(0, 0);
      assert.strictEqual(engine.ball.x, prevX + 3);
      assert.strictEqual(engine.ball.y, prevY + 2);
    });
  });

  describe('tick - wall bounce', () => {
    it('bounces off the top wall', () => {
      engine.ball.y = C.BALL_RADIUS - 1;
      engine.ball.vy = -3;
      engine.ball.vx = 0;
      engine.tick(0, 0);
      assert.ok(engine.ball.vy > 0);
    });

    it('bounces off the bottom wall', () => {
      engine.ball.y = C.CANVAS_HEIGHT - C.BALL_RADIUS + 1;
      engine.ball.vy = 3;
      engine.ball.vx = 0;
      engine.tick(0, 0);
      assert.ok(engine.ball.vy < 0);
    });
  });

  describe('tick - paddle collision', () => {
    it('reflects off the left paddle', () => {
      const paddleX = C.PADDLE_MARGIN + C.PADDLE_WIDTH;
      engine.ball.x = paddleX + C.BALL_RADIUS + 1;
      engine.ball.y = engine.paddleLeft.y + C.PADDLE_HEIGHT / 2;
      engine.ball.vx = -C.BALL_INITIAL_SPEED;
      engine.ball.vy = 0;
      engine.tick(0, 0);
      assert.ok(engine.ball.vx > 0, 'Ball should reverse direction');
    });

    it('reflects off the right paddle', () => {
      const paddleX = C.CANVAS_WIDTH - C.PADDLE_MARGIN - C.PADDLE_WIDTH;
      engine.ball.x = paddleX - C.BALL_RADIUS - 1;
      engine.ball.y = engine.paddleRight.y + C.PADDLE_HEIGHT / 2;
      engine.ball.vx = C.BALL_INITIAL_SPEED;
      engine.ball.vy = 0;
      engine.tick(0, 0);
      assert.ok(engine.ball.vx < 0, 'Ball should reverse direction');
    });

    it('increases ball speed on paddle hit', () => {
      const paddleX = C.PADDLE_MARGIN + C.PADDLE_WIDTH;
      engine.ball.x = paddleX + C.BALL_RADIUS + 1;
      engine.ball.y = engine.paddleLeft.y + C.PADDLE_HEIGHT / 2;
      engine.ball.vx = -C.BALL_INITIAL_SPEED;
      engine.ball.vy = 0;
      engine.ball.speed = C.BALL_INITIAL_SPEED;
      engine.tick(0, 0);
      assert.ok(engine.ball.speed > C.BALL_INITIAL_SPEED);
    });
  });

  describe('tick - scoring', () => {
    it('detects right player scoring when ball passes left edge', () => {
      engine.ball.x = C.BALL_RADIUS + 1;
      engine.ball.vx = -(C.BALL_RADIUS + 2);
      engine.ball.vy = 0;
      const { scored } = engine.tick(0, 0);
      assert.strictEqual(scored, 'right');
    });

    it('detects left player scoring when ball passes right edge', () => {
      engine.ball.x = C.CANVAS_WIDTH - C.BALL_RADIUS - 1;
      engine.ball.vx = C.BALL_RADIUS + 2;
      engine.ball.vy = 0;
      const { scored } = engine.tick(0, 0);
      assert.strictEqual(scored, 'left');
    });

    it('returns null when no score', () => {
      engine.ball.x = C.CANVAS_WIDTH / 2;
      engine.ball.vx = 1;
      engine.ball.vy = 0;
      const { scored } = engine.tick(0, 0);
      assert.strictEqual(scored, null);
    });
  });

  describe('tick - paddle movement', () => {
    it('moves left paddle up with input -1', () => {
      const prevY = engine.paddleLeft.y;
      engine.ball.vx = 0;
      engine.ball.vy = 0;
      engine.tick(-1, 0);
      assert.strictEqual(engine.paddleLeft.y, prevY - C.PADDLE_SPEED);
    });

    it('moves right paddle down with input 1', () => {
      const prevY = engine.paddleRight.y;
      engine.ball.vx = 0;
      engine.ball.vy = 0;
      engine.tick(0, 1);
      assert.strictEqual(engine.paddleRight.y, prevY + C.PADDLE_SPEED);
    });

    it('clamps paddle at top boundary', () => {
      engine.paddleLeft.y = 0;
      engine.ball.vx = 0;
      engine.ball.vy = 0;
      engine.tick(-1, 0);
      assert.strictEqual(engine.paddleLeft.y, 0);
    });

    it('clamps paddle at bottom boundary', () => {
      engine.paddleRight.y = C.CANVAS_HEIGHT - C.PADDLE_HEIGHT;
      engine.ball.vx = 0;
      engine.ball.vy = 0;
      engine.tick(0, 1);
      assert.strictEqual(engine.paddleRight.y, C.CANVAS_HEIGHT - C.PADDLE_HEIGHT);
    });
  });
});
