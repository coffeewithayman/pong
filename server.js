const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const GameManager = require('./src/game/GameManager');
const setupSocketHandlers = require('./src/socket/handlers');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Create game manager
const gameManager = new GameManager(io);

// Wire up socket handlers
setupSocketHandlers(io, gameManager);

// Test-only endpoint for forcing scores
if (process.env.NODE_ENV === 'test') {
  app.post('/test/score', express.json(), (req, res) => {
    const side = req.body && req.body.side;
    if (side === 'left' || side === 'right') {
      gameManager.forceScore(side);
      res.json({ ok: true });
    } else {
      res.status(400).json({ error: 'side must be "left" or "right"' });
    }
  });

  app.post('/test/reset', (req, res) => {
    gameManager.resetForTest();
    res.json({ ok: true });
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Pong server running on http://localhost:${PORT}`);
});

module.exports = { app, server, io, gameManager };
