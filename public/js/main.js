// Main client entry point
(function () {
  const socket = io();
  let constants = null;
  let playerInfo = null;
  let gameStatus = 'waiting';
  let mySide = null;
  let lastState = null;

  UI.init();
  Input.init(socket);

  // Receive constants from server
  socket.on('constants', (data) => {
    constants = data;
    Renderer.init(document.getElementById('game-canvas'), constants);
  });

  // Full state on connect
  socket.on('full-state', (data) => {
    gameStatus = data.status;
    playerInfo = data.playerInfo;
    lastState = data.gameState;
    UI.updateLeaderboard(data.leaderboard);
    UI.updatePlayerLabels(playerInfo);
    UI.updateQueueList(data.queueNames);

    if (lastState) {
      if (gameStatus === 'waiting') {
        Renderer.drawWaiting();
      } else {
        Renderer.draw(lastState, playerInfo);
      }
    }
  });

  // Show name modal
  UI.showNameModal(
    (name) => {
      socket.emit('join', { name });
      UI.setStatus('Waiting for game...', 'spectating');
    },
    () => {
      UI.setStatus('Spectating', 'spectating');
    }
  );

  // Game state updates (60fps from server)
  socket.on('state', (state) => {
    lastState = state;
    if (constants) {
      Renderer.draw(state, playerInfo);
    }
  });

  // Assigned as a player
  socket.on('your-turn', (data) => {
    mySide = data.side;
    Input.setPlayerState(true);
    const sideLabel = data.side === 'left' ? 'Champion (Left)' : 'Challenger (Right)';
    UI.setStatus(`Your turn! You are the ${sideLabel}`, 'playing');
  });

  // Side changed (promoted to champion)
  socket.on('side-change', (data) => {
    mySide = data.side;
    UI.setStatus('You are now the Champion (Left)!', 'playing');
  });

  // Queued
  socket.on('queued', (data) => {
    mySide = null;
    Input.setPlayerState(false);
    UI.setStatus(`In queue: #${data.position} of ${data.total}`, 'queued');
  });

  // Queue position update
  socket.on('queue-update', (data) => {
    UI.setStatus(`In queue: #${data.position} of ${data.total}`, 'queued');
  });

  // Eliminated
  socket.on('eliminated', (data) => {
    mySide = null;
    Input.setPlayerState(false);
    const time = UI.formatTime(data.survivalMs);
    UI.setStatus(`Eliminated! You survived ${time} with ${data.points} points`, 'eliminated');
  });

  // Player info updates
  socket.on('player-info', (data) => {
    playerInfo = data;
    UI.updatePlayerLabels(data);
  });

  // Score event (someone got eliminated)
  socket.on('score-event', (data) => {
    if (data.loserName && lastState && constants) {
      Renderer.draw(lastState, playerInfo);
      Renderer.drawScoreEvent(`${data.loserName} eliminated!`);
    }
  });

  // Game status
  socket.on('game-status', (data) => {
    gameStatus = data.status;
    if (data.status === 'waiting' && !mySide) {
      UI.setStatus('Watching - waiting for players...', 'spectating');
      if (constants) Renderer.drawWaiting();
    }
  });

  // Leaderboard updates
  socket.on('leaderboard', (entries) => {
    UI.updateLeaderboard(entries);
  });

  // Queue list updates
  socket.on('queue-list', (names) => {
    UI.updateQueueList(names);
  });

  // Connection status
  socket.on('connect', () => {
    if (!mySide) {
      UI.setStatus('Connected - spectating', 'spectating');
    }
  });

  socket.on('disconnect', () => {
    UI.setStatus('Disconnected - reconnecting...', '');
    mySide = null;
    Input.setPlayerState(false);
  });
})();
