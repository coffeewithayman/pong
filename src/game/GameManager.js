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

const GameEngine = require('./GameEngine');
const GameLoop = require('./GameLoop');
const PlayerQueue = require('../queue/PlayerQueue');
const Leaderboard = require('../leaderboard/Leaderboard');
const C = require('./constants');

class GameManager {
  constructor(io) {
    this.io = io;
    this.engine = new GameEngine();
    this.queue = new PlayerQueue();
    this.leaderboard = new Leaderboard();
    this.loop = new GameLoop(this.engine, (result) => this.onTick(result));

    // Player slots
    this.playerLeft = null;  // { socketId, name, startTime, points }
    this.playerRight = null;

    this.status = 'waiting'; // waiting | playing | paused | countdown
    this.pauseTimeout = null;
    this.countdownTimeout = null;
  }

  onTick(result) {
    // Broadcast state to all connected clients
    this.io.to('game').emit('state', result.state);

    if (result.scored) {
      this.onScore(result.scored);
    }
  }

  onScore(scoringSide) {
    // scoringSide = 'left' means left player scored (ball passed right), right player loses
    // scoringSide = 'right' means right player scored (ball passed left), left player loses
    this.loop.stop();
    this.status = 'paused';

    const loserSide = scoringSide === 'left' ? 'right' : 'left';
    const loser = loserSide === 'left' ? this.playerLeft : this.playerRight;
    const winner = loserSide === 'left' ? this.playerRight : this.playerLeft;

    if (loser) {
      // Record loser's stats to leaderboard
      const survivalMs = Date.now() - loser.startTime;
      this.leaderboard.addEntry(loser.name, survivalMs, loser.points);

      // Notify the loser
      const loserSocket = this.io.sockets.sockets.get(loser.socketId);
      if (loserSocket) {
        loserSocket.emit('eliminated', { survivalMs, points: loser.points });
      }

      // Broadcast updated leaderboard
      this.io.to('game').emit('leaderboard', this.leaderboard.getTop());
    }

    if (winner) {
      winner.points++;
    }

    // Clear loser slot
    if (loserSide === 'left') {
      this.playerLeft = null;
    } else {
      this.playerRight = null;
    }

    // After pause, bring in next player
    this.io.to('game').emit('score-event', {
      scoringSide,
      loserName: loser ? loser.name : null,
      winnerName: winner ? winner.name : null,
    });

    this.pauseTimeout = setTimeout(() => {
      this.fillSlots();
    }, C.SCORE_PAUSE_MS);
  }

  fillSlots() {
    // If champion (left) was eliminated, challenger becomes champion
    if (!this.playerLeft && this.playerRight) {
      this.playerLeft = this.playerRight;
      this.playerRight = null;
      const socket = this.io.sockets.sockets.get(this.playerLeft.socketId);
      if (socket) socket.emit('side-change', { side: 'left' });
    }

    // Fill right slot from queue
    if (!this.playerRight) {
      const next = this.queue.dequeue();
      if (next) {
        this.playerRight = {
          socketId: next.socketId,
          name: next.name,
          startTime: Date.now(),
          points: 0,
        };
        const socket = this.io.sockets.sockets.get(next.socketId);
        if (socket) socket.emit('your-turn', { side: 'right' });
      }
    }

    // Fill left slot if still empty (fresh start)
    if (!this.playerLeft) {
      const next = this.queue.dequeue();
      if (next) {
        this.playerLeft = {
          socketId: next.socketId,
          name: next.name,
          startTime: Date.now(),
          points: 0,
        };
        const socket = this.io.sockets.sockets.get(next.socketId);
        if (socket) socket.emit('your-turn', { side: 'left' });
      }
    }

    // Broadcast queue updates
    this.broadcastQueuePositions();
    this.broadcastPlayerInfo();

    if (this.playerLeft && this.playerRight) {
      this.startCountdown();
    } else {
      this.status = 'waiting';
      this.io.to('game').emit('game-status', { status: 'waiting' });
    }
  }

  startCountdown() {
    this.engine.reset();
    this.loop.resetInputs();
    this.status = 'countdown';
    this.io.to('game').emit('game-status', { status: 'countdown' });

    // Notify both players about their sides
    this.io.to('game').emit('countdown', { seconds: 3 });

    // Notify that a new player joined (for doorbell sound)
    this.io.to('game').emit('new-player-joined', {
      name: this.playerRight ? this.playerRight.name : null,
    });

    let remaining = 2;
    this.countdownTimeout = setInterval(() => {
      if (remaining > 0) {
        this.io.to('game').emit('countdown', { seconds: remaining });
        remaining--;
      } else {
        clearInterval(this.countdownTimeout);
        this.countdownTimeout = null;
        this.startGame();
      }
    }, 1000);
  }

  startGame() {
    this.status = 'playing';
    this.io.to('game').emit('game-status', { status: 'playing' });
    this.io.to('game').emit('countdown', { seconds: 0 });
    // Set start times now that game actually begins
    if (this.playerLeft) this.playerLeft.startTime = Date.now();
    if (this.playerRight) this.playerRight.startTime = Date.now();
    this.loop.start();
  }

  handleJoin(socket, name) {
    // If a slot is open, assign directly
    if (!this.playerLeft) {
      this.playerLeft = {
        socketId: socket.id,
        name,
        startTime: Date.now(),
        points: 0,
      };
      socket.emit('your-turn', { side: 'left' });
      this.broadcastPlayerInfo();
      if (this.playerRight) {
        this.startCountdown();
      } else {
        this.io.to('game').emit('game-status', { status: 'waiting' });
      }
    } else if (!this.playerRight) {
      this.playerRight = {
        socketId: socket.id,
        name,
        startTime: Date.now(),
        points: 0,
      };
      socket.emit('your-turn', { side: 'right' });
      this.broadcastPlayerInfo();
      if (this.playerLeft) {
        this.startCountdown();
      }
    } else {
      // Both slots full, add to queue
      this.queue.enqueue(socket.id, name);
      socket.emit('queued', {
        position: this.queue.getPosition(socket.id),
        total: this.queue.size(),
      });
      this.broadcastQueuePositions();
    }
  }

  handleInput(socket, direction) {
    if (this.playerLeft && this.playerLeft.socketId === socket.id) {
      this.loop.setInput('left', direction);
    } else if (this.playerRight && this.playerRight.socketId === socket.id) {
      this.loop.setInput('right', direction);
    }
    // Ignore input from spectators/queued players
  }

  handleDisconnect(socket) {
    // If they were in queue, just remove
    if (this.queue.remove(socket.id)) {
      this.broadcastQueuePositions();
      return;
    }

    // If disconnecting during countdown, cancel it
    if (this.countdownTimeout) {
      clearInterval(this.countdownTimeout);
      this.countdownTimeout = null;
    }

    // If they were an active player, treat as forfeit
    if (this.playerLeft && this.playerLeft.socketId === socket.id) {
      const survivalMs = Date.now() - this.playerLeft.startTime;
      this.leaderboard.addEntry(this.playerLeft.name, survivalMs, this.playerLeft.points);
      this.playerLeft = null;
      this.loop.stop();
      this.io.to('game').emit('leaderboard', this.leaderboard.getTop());
      this.io.to('game').emit('score-event', {
        scoringSide: 'right',
        loserName: null,
        winnerName: this.playerRight ? this.playerRight.name : null,
      });
      clearTimeout(this.pauseTimeout);
      setTimeout(() => this.fillSlots(), C.SCORE_PAUSE_MS);
    } else if (this.playerRight && this.playerRight.socketId === socket.id) {
      const survivalMs = Date.now() - this.playerRight.startTime;
      this.leaderboard.addEntry(this.playerRight.name, survivalMs, this.playerRight.points);
      this.playerRight = null;
      this.loop.stop();
      this.io.to('game').emit('leaderboard', this.leaderboard.getTop());
      this.io.to('game').emit('score-event', {
        scoringSide: 'left',
        loserName: null,
        winnerName: this.playerLeft ? this.playerLeft.name : null,
      });
      clearTimeout(this.pauseTimeout);
      setTimeout(() => this.fillSlots(), C.SCORE_PAUSE_MS);
    }
  }

  // Force a score for testing
  forceScore(side) {
    // If in countdown, skip to playing first
    if (this.status === 'countdown' && this.countdownTimeout) {
      clearInterval(this.countdownTimeout);
      this.countdownTimeout = null;
      this.startGame();
    }
    if (this.status === 'playing') {
      this.onScore(side);
    }
  }

  // Reset game state for testing
  resetForTest() {
    this.loop.stop();
    clearTimeout(this.pauseTimeout);
    if (this.countdownTimeout) {
      clearInterval(this.countdownTimeout);
      this.countdownTimeout = null;
    }
    this.playerLeft = null;
    this.playerRight = null;
    this.queue = new PlayerQueue();
    this.engine.reset();
    this.loop.resetInputs();
    this.status = 'waiting';
    // Reset leaderboard
    this.leaderboard.entries = [];
    this.leaderboard.save();
    this.io.to('game').emit('game-status', { status: 'waiting' });
  }

  broadcastQueuePositions() {
    const all = this.queue.getAll();
    all.forEach((p, i) => {
      const socket = this.io.sockets.sockets.get(p.socketId);
      if (socket) {
        socket.emit('queue-update', { position: i + 1, total: all.length });
      }
    });
    this.broadcastQueueList();
  }

  broadcastQueueList() {
    const all = this.queue.getAll();
    this.io.to('game').emit('queue-list', all.map((p) => p.name));
  }

  broadcastPlayerInfo() {
    this.io.to('game').emit('player-info', {
      left: this.playerLeft ? { name: this.playerLeft.name, points: this.playerLeft.points } : null,
      right: this.playerRight ? { name: this.playerRight.name, points: this.playerRight.points } : null,
    });
  }

  getFullState() {
    return {
      status: this.status,
      gameState: this.engine.getState(),
      playerInfo: {
        left: this.playerLeft ? { name: this.playerLeft.name, points: this.playerLeft.points } : null,
        right: this.playerRight ? { name: this.playerRight.name, points: this.playerRight.points } : null,
      },
      leaderboard: this.leaderboard.getTop(),
      queueSize: this.queue.size(),
      queueNames: this.queue.getAll().map((p) => p.name),
      colors: { left: '#4fc3f7', right: '#ff9800' },
    };
  }
}

module.exports = GameManager;
