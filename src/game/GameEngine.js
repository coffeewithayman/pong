{/* Pong Online - Longest player of pong with waiting room and spectate mode
Copyright (C) 2026 Ayman Elsawah

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>. */}


const C = require('./constants');

class GameEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.ball = {
      x: C.CANVAS_WIDTH / 2,
      y: C.CANVAS_HEIGHT / 2,
      vx: 0,
      vy: 0,
      speed: C.BALL_INITIAL_SPEED,
    };
    this.paddleLeft = {
      y: (C.CANVAS_HEIGHT - C.PADDLE_HEIGHT) / 2,
    };
    this.paddleRight = {
      y: (C.CANVAS_HEIGHT - C.PADDLE_HEIGHT) / 2,
    };
    this.launchBall();
  }

  launchBall() {
    const angle = (Math.random() * Math.PI / 3) - Math.PI / 6; // -30 to +30 degrees
    const direction = Math.random() < 0.5 ? -1 : 1;
    this.ball.speed = C.BALL_INITIAL_SPEED;
    this.ball.vx = direction * Math.cos(angle) * this.ball.speed;
    this.ball.vy = Math.sin(angle) * this.ball.speed;
    this.ball.x = C.CANVAS_WIDTH / 2;
    this.ball.y = C.CANVAS_HEIGHT / 2;
  }

  tick(leftInput, rightInput) {
    // Move paddles
    this.movePaddle(this.paddleLeft, leftInput);
    this.movePaddle(this.paddleRight, rightInput);

    // Move ball
    this.ball.x += this.ball.vx;
    this.ball.y += this.ball.vy;

    // Wall bounce (top/bottom)
    if (this.ball.y - C.BALL_RADIUS <= 0) {
      this.ball.y = C.BALL_RADIUS;
      this.ball.vy = Math.abs(this.ball.vy);
    } else if (this.ball.y + C.BALL_RADIUS >= C.CANVAS_HEIGHT) {
      this.ball.y = C.CANVAS_HEIGHT - C.BALL_RADIUS;
      this.ball.vy = -Math.abs(this.ball.vy);
    }

    // Left paddle collision
    const leftPaddleX = C.PADDLE_MARGIN;
    if (
      this.ball.vx < 0 &&
      this.ball.x - C.BALL_RADIUS <= leftPaddleX + C.PADDLE_WIDTH &&
      this.ball.x - C.BALL_RADIUS >= leftPaddleX - C.BALL_RADIUS &&
      this.ball.y >= this.paddleLeft.y &&
      this.ball.y <= this.paddleLeft.y + C.PADDLE_HEIGHT
    ) {
      this.ball.x = leftPaddleX + C.PADDLE_WIDTH + C.BALL_RADIUS;
      this.reflectOffPaddle(this.paddleLeft, 1);
    }

    // Right paddle collision
    const rightPaddleX = C.CANVAS_WIDTH - C.PADDLE_MARGIN - C.PADDLE_WIDTH;
    if (
      this.ball.vx > 0 &&
      this.ball.x + C.BALL_RADIUS >= rightPaddleX &&
      this.ball.x + C.BALL_RADIUS <= rightPaddleX + C.PADDLE_WIDTH + C.BALL_RADIUS &&
      this.ball.y >= this.paddleRight.y &&
      this.ball.y <= this.paddleRight.y + C.PADDLE_HEIGHT
    ) {
      this.ball.x = rightPaddleX - C.BALL_RADIUS;
      this.reflectOffPaddle(this.paddleRight, -1);
    }

    // Scoring detection
    let scored = null;
    if (this.ball.x - C.BALL_RADIUS <= 0) {
      scored = 'right'; // right player scored (ball passed left)
    } else if (this.ball.x + C.BALL_RADIUS >= C.CANVAS_WIDTH) {
      scored = 'left'; // left player scored (ball passed right)
    }

    return { state: this.getState(), scored };
  }

  reflectOffPaddle(paddle, directionX) {
    const hitPos = (this.ball.y - paddle.y) / C.PADDLE_HEIGHT; // 0 to 1
    const angle = (hitPos - 0.5) * (Math.PI / 3); // -60 to +60 degrees
    this.ball.speed = Math.min(this.ball.speed + C.BALL_SPEED_INCREMENT, C.BALL_MAX_SPEED);
    this.ball.vx = directionX * Math.cos(angle) * this.ball.speed;
    this.ball.vy = Math.sin(angle) * this.ball.speed;
  }

  movePaddle(paddle, input) {
    if (input === -1) {
      paddle.y = Math.max(0, paddle.y - C.PADDLE_SPEED);
    } else if (input === 1) {
      paddle.y = Math.min(C.CANVAS_HEIGHT - C.PADDLE_HEIGHT, paddle.y + C.PADDLE_SPEED);
    }
  }

  getState() {
    return {
      ball: { x: this.ball.x, y: this.ball.y },
      paddleLeft: { y: this.paddleLeft.y },
      paddleRight: { y: this.paddleRight.y },
    };
  }
}

module.exports = GameEngine;
