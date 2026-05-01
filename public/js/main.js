// Main client entry point
(function () {
  const socket = io();
  let constants = null;
  let playerInfo = null;
  let gameStatus = 'waiting';
  let mySide = null;
  let lastState = null;
  let myName = null;

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
    if (data.colors) {
      Renderer.colors = data.colors;
      UI.colors = data.colors;
    }
    UI.updateLeaderboard(data.leaderboard);
    UI.updatePlayerLabels(playerInfo);
    UI.updateQueueList(data.queueNames);

    if (lastState) {
      if (gameStatus === 'waiting') {
        Renderer.drawWaiting();
      } else if (gameStatus === 'countdown') {
        Renderer.drawCountdown(3, playerInfo);
      } else {
        Renderer.draw(lastState, playerInfo);
      }
    }
  });

  // Show name modal
  UI.showNameModal(
    (name) => {
      myName = name;
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

  // Countdown event
  socket.on('countdown', (data) => {
    if (data.seconds > 0 && constants) {
      Renderer.drawCountdown(data.seconds, playerInfo);
      if (mySide) {
        const sideLabel = mySide === 'left' ? 'Champion (Left)' : 'Challenger (Right)';
        const color = mySide === 'left' ? Renderer.colors.left : Renderer.colors.right;
        UI.setStatus(`Your turn! Starting in ${data.seconds}... You are the ${sideLabel}`, 'countdown');
        UI.statusText.style.color = color;
      } else {
        UI.setStatus(`New match starting in ${data.seconds}...`, 'countdown');
      }
    }
  });

  // New player joined - play doorbell
  socket.on('new-player-joined', () => {
    UI.playDoorbell();

    // Bring tab to attention if hidden
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Pong Online', { body: 'A new challenger has arrived!', icon: '/favicon.svg' });
    }

    // Flash the document title
    if (document.hidden) {
      const originalTitle = document.title;
      let flashing = true;
      const flashInterval = setInterval(() => {
        document.title = flashing ? '🏓 New Challenger!' : originalTitle;
        flashing = !flashing;
      }, 500);

      const stopFlash = () => {
        clearInterval(flashInterval);
        document.title = originalTitle;
        document.removeEventListener('visibilitychange', stopFlash);
      };
      document.addEventListener('visibilitychange', stopFlash);

      // Auto-stop after 10 seconds
      setTimeout(stopFlash, 10000);
    }
  });

  // Assigned as a player
  socket.on('your-turn', (data) => {
    mySide = data.side;
    Input.setPlayerState(true);
    const sideLabel = data.side === 'left' ? 'Champion (Left)' : 'Challenger (Right)';
    const color = data.side === 'left' ? Renderer.colors.left : Renderer.colors.right;
    UI.setStatus(`Your turn! You are the ${sideLabel}`, 'playing');
    UI.statusText.style.color = color;
    Input.setControlColor(color);
  });

  // Side changed (promoted to champion)
  socket.on('side-change', (data) => {
    mySide = data.side;
    UI.setStatus('You are now the Champion (Left)!', 'playing');
    UI.statusText.style.color = Renderer.colors.left;
    Input.setControlColor(Renderer.colors.left);
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
    Input.setControlColor(null);
    UI.showEliminatedModal(data.survivalMs, data.points, () => {
      socket.emit('join', { name: myName });
      UI.setStatus('Waiting for game...', 'spectating');
    });
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
    } else if (data.status === 'playing' && mySide) {
      const sideLabel = mySide === 'left' ? 'Champion (Left)' : 'Challenger (Right)';
      const color = mySide === 'left' ? Renderer.colors.left : Renderer.colors.right;
      UI.setStatus(`Playing! You are the ${sideLabel}`, 'playing');
      UI.statusText.style.color = color;
    } else if (data.status === 'playing' && !mySide) {
      UI.setStatus('Watching', 'spectating');
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
    Input.setControlColor(null);
  });
})();
