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

    this.status = 'waiting'; // waiting | playing | paused
    this.pauseTimeout = null;
  }

  log(action, details = {}) {
    const state = {
      status: this.status,
      playerLeft: this.playerLeft ? `${this.playerLeft.name} (${this.playerLeft.socketId})` : null,
      playerRight: this.playerRight ? `${this.playerRight.name} (${this.playerRight.socketId})` : null,
      queueSize: this.queue.size(),
      loopRunning: this.loop.running,
      hasPauseTimeout: this.pauseTimeout !== null,
    };
    console.log(`[GameManager] ${action}`, JSON.stringify({ ...details, state }));
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

    this.log('score', { scoringSide, loserSide, loserName: loser?.name, winnerName: winner?.name });

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

    this.clearPauseTimeout();
    this.pauseTimeout = setTimeout(() => {
      this.pauseTimeout = null;
      this.fillSlots();
    }, C.SCORE_PAUSE_MS);
  }

  clearPauseTimeout() {
    if (this.pauseTimeout) {
      clearTimeout(this.pauseTimeout);
      this.pauseTimeout = null;
    }
  }

  fillSlots() {
    this.log('fillSlots:start');

    // If champion (left) was eliminated, challenger becomes champion
    if (!this.playerLeft && this.playerRight) {
      this.playerLeft = this.playerRight;
      this.playerRight = null;
      this.log('fillSlots:promote', { promoted: this.playerLeft.name });
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
        this.log('fillSlots:dequeue-right', { name: next.name });
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
        this.log('fillSlots:dequeue-left', { name: next.name });
        const socket = this.io.sockets.sockets.get(next.socketId);
        if (socket) socket.emit('your-turn', { side: 'left' });
      }
    }

    // Broadcast queue updates
    this.broadcastQueuePositions();
    this.broadcastPlayerInfo();

    if (this.playerLeft && this.playerRight) {
      this.startGame();
    } else {
      this.status = 'waiting';
      this.io.to('game').emit('game-status', { status: 'waiting' });
      this.log('fillSlots:waiting');
    }
  }

  startGame() {
    this.log('startGame');
    this.engine.reset();
    this.loop.resetInputs();
    this.status = 'playing';
    this.io.to('game').emit('game-status', { status: 'playing' });
    this.loop.start();
  }

  handleJoin(socket, name) {
    // Prevent duplicate joins: if this socket is already a player, ignore
    if (this.playerLeft && this.playerLeft.socketId === socket.id) {
      this.log('join:duplicate-ignored', { socketId: socket.id, name, existingSide: 'left' });
      return;
    }
    if (this.playerRight && this.playerRight.socketId === socket.id) {
      this.log('join:duplicate-ignored', { socketId: socket.id, name, existingSide: 'right' });
      return;
    }
    // Also check if already in queue
    if (this.queue.getPosition(socket.id) > 0) {
      this.log('join:already-queued', { socketId: socket.id, name });
      return;
    }

    this.log('join', { socketId: socket.id, name });

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
        // Cancel any pending fillSlots since we're starting the game now
        this.clearPauseTimeout();
        this.startGame();
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
        // Cancel any pending fillSlots since we're starting the game now
        this.clearPauseTimeout();
        this.startGame();
      }
    } else {
      // Both slots full, add to queue
      this.queue.enqueue(socket.id, name);
      this.log('join:queued', { socketId: socket.id, name, position: this.queue.getPosition(socket.id) });
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
    this.log('disconnect', { socketId: socket.id });

    // If they were in queue, just remove
    if (this.queue.remove(socket.id)) {
      this.log('disconnect:removed-from-queue', { socketId: socket.id });
      this.broadcastQueuePositions();
      return;
    }

    // If they were an active player, treat as forfeit
    if (this.playerLeft && this.playerLeft.socketId === socket.id) {
      const name = this.playerLeft.name;
      const survivalMs = Date.now() - this.playerLeft.startTime;
      this.leaderboard.addEntry(this.playerLeft.name, survivalMs, this.playerLeft.points);
      this.playerLeft = null;
      this.loop.stop();
      this.log('disconnect:left-player-forfeited', { socketId: socket.id, name });
      this.io.to('game').emit('leaderboard', this.leaderboard.getTop());
      this.io.to('game').emit('score-event', {
        scoringSide: 'right',
        loserName: name,
        winnerName: this.playerRight ? this.playerRight.name : null,
      });
      this.clearPauseTimeout();
      this.pauseTimeout = setTimeout(() => {
        this.pauseTimeout = null;
        this.fillSlots();
      }, C.SCORE_PAUSE_MS);
    } else if (this.playerRight && this.playerRight.socketId === socket.id) {
      const name = this.playerRight.name;
      const survivalMs = Date.now() - this.playerRight.startTime;
      this.leaderboard.addEntry(this.playerRight.name, survivalMs, this.playerRight.points);
      this.playerRight = null;
      this.loop.stop();
      this.log('disconnect:right-player-forfeited', { socketId: socket.id, name });
      this.io.to('game').emit('leaderboard', this.leaderboard.getTop());
      this.io.to('game').emit('score-event', {
        scoringSide: 'left',
        loserName: name,
        winnerName: this.playerLeft ? this.playerLeft.name : null,
      });
      this.clearPauseTimeout();
      this.pauseTimeout = setTimeout(() => {
        this.pauseTimeout = null;
        this.fillSlots();
      }, C.SCORE_PAUSE_MS);
    } else {
      this.log('disconnect:spectator', { socketId: socket.id });
    }
  }

  // Force a score for testing
  forceScore(side) {
    if (this.status === 'playing') {
      this.onScore(side);
    }
  }

  // Reset game state for testing
  resetForTest() {
    this.loop.stop();
    this.clearPauseTimeout();
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
    this.log('resetForTest');
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
    };
  }
}

module.exports = GameManager;
