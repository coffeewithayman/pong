const C = require('../game/constants');

function setupSocketHandlers(io, gameManager) {
  io.on('connection', (socket) => {
    console.log(`[CONNECT] New socket connected: ${socket.id}`);
    // Join the game room for broadcasts
    socket.join('game');

    // Send constants and current full state
    socket.emit('constants', {
      CANVAS_WIDTH: C.CANVAS_WIDTH,
      CANVAS_HEIGHT: C.CANVAS_HEIGHT,
      PADDLE_WIDTH: C.PADDLE_WIDTH,
      PADDLE_HEIGHT: C.PADDLE_HEIGHT,
      PADDLE_MARGIN: C.PADDLE_MARGIN,
      BALL_RADIUS: C.BALL_RADIUS,
    });
    socket.emit('full-state', gameManager.getFullState());

    // Player joins with a name
    socket.on('join', (data) => {
      const name = (data && data.name) ? data.name.toString().trim().slice(0, 20) : 'Anonymous';
      if (!name) return;
      gameManager.handleJoin(socket, name);
    });

    // Player input
    socket.on('input', (data) => {
      const dir = data && data.direction;
      if (dir === -1 || dir === 0 || dir === 1) {
        gameManager.handleInput(socket, dir);
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      gameManager.handleDisconnect(socket);
    });
  });
}

module.exports = setupSocketHandlers;
