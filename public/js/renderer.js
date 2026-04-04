// Canvas renderer for the Pong game
const Renderer = {
  canvas: null,
  ctx: null,
  constants: null,
  scaleX: 1,
  scaleY: 1,
  countdownValue: 0,
  colors: { left: '#4fc3f7', right: '#ff9800' },

  init(canvasEl, constants) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.constants = constants;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.scaleX = this.canvas.width / this.constants.CANVAS_WIDTH;
    this.scaleY = this.canvas.height / this.constants.CANVAS_HEIGHT;
    this.ctx.setTransform(this.scaleX, 0, 0, this.scaleY, 0, 0);
  },

  draw(state, playerInfo) {
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      this.resize();
    }
    const ctx = this.ctx;
    const C = this.constants;

    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, C.CANVAS_WIDTH, C.CANVAS_HEIGHT);

    // Center line
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(C.CANVAS_WIDTH / 2, 0);
    ctx.lineTo(C.CANVAS_WIDTH / 2, C.CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Left paddle - colored
    ctx.fillStyle = this.colors.left;
    ctx.fillRect(
      C.PADDLE_MARGIN,
      state.paddleLeft.y,
      C.PADDLE_WIDTH,
      C.PADDLE_HEIGHT
    );
    // Right paddle - colored
    ctx.fillStyle = this.colors.right;
    ctx.fillRect(
      C.CANVAS_WIDTH - C.PADDLE_MARGIN - C.PADDLE_WIDTH,
      state.paddleRight.y,
      C.PADDLE_WIDTH,
      C.PADDLE_HEIGHT
    );

    // Ball
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, C.BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Player names and points (color-coded)
    ctx.font = '20px "Courier New", monospace';
    ctx.textAlign = 'center';
    if (playerInfo) {
      if (playerInfo.left) {
        ctx.fillStyle = this.colors.left;
        ctx.fillText(
          `${playerInfo.left.name} [${playerInfo.left.points}]`,
          C.CANVAS_WIDTH / 4,
          30
        );
      }
      if (playerInfo.right) {
        ctx.fillStyle = this.colors.right;
        ctx.fillText(
          `${playerInfo.right.name} [${playerInfo.right.points}]`,
          (C.CANVAS_WIDTH * 3) / 4,
          30
        );
      }
    }
  },

  drawWaiting() {
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      this.resize();
    }
    const ctx = this.ctx;
    const C = this.constants;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, C.CANVAS_WIDTH, C.CANVAS_HEIGHT);

    ctx.fillStyle = '#555';
    ctx.font = '28px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for players...', C.CANVAS_WIDTH / 2, C.CANVAS_HEIGHT / 2);
  },

  drawCountdown(seconds, playerInfo) {
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      this.resize();
    }
    const ctx = this.ctx;
    const C = this.constants;

    // Draw the game state in the background (paddles at starting positions)
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, C.CANVAS_WIDTH, C.CANVAS_HEIGHT);

    // Center line
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(C.CANVAS_WIDTH / 2, 0);
    ctx.lineTo(C.CANVAS_WIDTH / 2, C.CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Paddles at center
    const paddleY = (C.CANVAS_HEIGHT - C.PADDLE_HEIGHT) / 2;
    ctx.fillStyle = this.colors.left;
    ctx.fillRect(C.PADDLE_MARGIN, paddleY, C.PADDLE_WIDTH, C.PADDLE_HEIGHT);
    ctx.fillStyle = this.colors.right;
    ctx.fillRect(C.CANVAS_WIDTH - C.PADDLE_MARGIN - C.PADDLE_WIDTH, paddleY, C.PADDLE_WIDTH, C.PADDLE_HEIGHT);

    // Player names
    ctx.font = '20px "Courier New", monospace';
    ctx.textAlign = 'center';
    if (playerInfo) {
      if (playerInfo.left) {
        ctx.fillStyle = this.colors.left;
        ctx.fillText(
          `${playerInfo.left.name} [${playerInfo.left.points}]`,
          C.CANVAS_WIDTH / 4,
          30
        );
      }
      if (playerInfo.right) {
        ctx.fillStyle = this.colors.right;
        ctx.fillText(
          `${playerInfo.right.name} [${playerInfo.right.points}]`,
          (C.CANVAS_WIDTH * 3) / 4,
          30
        );
      }
    }

    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, C.CANVAS_WIDTH, C.CANVAS_HEIGHT);

    // Countdown number
    if (seconds > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 120px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(seconds), C.CANVAS_WIDTH / 2, C.CANVAS_HEIGHT / 2);
      ctx.textBaseline = 'alphabetic';

      // "Get Ready!" text
      ctx.fillStyle = '#aaa';
      ctx.font = '24px "Courier New", monospace';
      ctx.fillText('Get Ready!', C.CANVAS_WIDTH / 2, C.CANVAS_HEIGHT / 2 + 80);
    }
  },

  drawScoreEvent(msg) {
    const ctx = this.ctx;
    const C = this.constants;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, C.CANVAS_HEIGHT / 2 - 40, C.CANVAS_WIDTH, 80);

    ctx.fillStyle = '#f44';
    ctx.font = '24px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(msg, C.CANVAS_WIDTH / 2, C.CANVAS_HEIGHT / 2 + 8);
  },
};
