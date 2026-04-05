// UI manager for status, leaderboard, and modals
const UI = {
  colors: { left: '#4fc3f7', right: '#ff9800' },
  doorbellAudioCtx: null,

  init() {
    this.statusText = document.getElementById('status-text');
    this.nameModal = document.getElementById('name-modal');
    this.nameInput = document.getElementById('name-input');
    this.joinBtn = document.getElementById('join-btn');
    this.gameContainer = document.getElementById('game-container');
    this.leaderboardBody = document.getElementById('leaderboard-body');
    this.queueList = document.getElementById('queue-list');
    this.playerLeftLabel = document.getElementById('player-left-label');
    this.playerRightLabel = document.getElementById('player-right-label');
    this.spectateBtn = document.getElementById('spectate-btn');
    this.eliminatedModal = document.getElementById('eliminated-modal');
    this.eliminatedStats = document.getElementById('eliminated-stats');
    this.rejoinBtn = document.getElementById('rejoin-btn');
    this.gameTimer = document.getElementById('game-timer');
  },

  showNameModal(onJoin, onSpectate) {
    this.nameModal.classList.remove('hidden');
    this.gameContainer.classList.remove('active');
    const saved = localStorage.getItem('pong-name');
    if (saved) this.nameInput.value = saved;
    this.nameInput.focus();

    const submit = () => {
      const name = this.nameInput.value.trim();
      if (name) {
        localStorage.setItem('pong-name', name);
        onJoin(name);
        this.nameModal.classList.add('hidden');
        this.gameContainer.classList.add('active');
      }
    };

    this.joinBtn.onclick = submit;
    this.nameInput.onkeydown = (e) => {
      if (e.key === 'Enter') submit();
    };

    this.spectateBtn.onclick = () => {
      onSpectate();
      this.nameModal.classList.add('hidden');
      this.gameContainer.classList.add('active');
    };
  },

  setStatus(text, className) {
    this.statusText.textContent = text;
    this.statusText.className = className || '';
  },

  showEliminatedModal(survivalMs, points, callback) {
    const time = this.formatTime(survivalMs);
    this.eliminatedStats.textContent = `You survived ${time} with ${points} points`;

    const handleRejoin = () => {
      this.hideEliminatedModal();
      callback();
    };

    this.rejoinBtn.onclick = handleRejoin;

    this._rejoinKeyHandler = (e) => {
      if (e.key === 'Enter') handleRejoin();
    };

    document.addEventListener('keydown', this._rejoinKeyHandler);
    this.eliminatedModal.classList.remove('hidden');
  },

  hideEliminatedModal() {
    if (this._rejoinKeyHandler) {
      document.removeEventListener('keydown', this._rejoinKeyHandler);
      this._rejoinKeyHandler = null;
    }
    this.rejoinBtn.onclick = null;
    this.eliminatedModal.classList.add('hidden');
  },

  updateLeaderboard(entries) {
    this.leaderboardBody.innerHTML = '';
    entries.forEach((entry, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${this.escapeHtml(entry.name)}</td>
        <td>${this.formatTime(entry.survivalMs)}</td>
        <td>${entry.points}</td>
      `;
      this.leaderboardBody.appendChild(tr);
    });
  },

  updatePlayerLabels(playerInfo) {
    if (playerInfo && playerInfo.left) {
      this.playerLeftLabel.textContent = `${playerInfo.left.name} [${playerInfo.left.points}]`;
      this.playerLeftLabel.style.color = this.colors.left;
    } else {
      this.playerLeftLabel.textContent = '';
    }
    if (playerInfo && playerInfo.right) {
      this.playerRightLabel.textContent = `${playerInfo.right.name} [${playerInfo.right.points}]`;
      this.playerRightLabel.style.color = this.colors.right;
    } else {
      this.playerRightLabel.textContent = '';
    }
  },

  updateQueueList(names) {
    this.queueList.innerHTML = '';
    if (!names || names.length === 0) {
      const li = document.createElement('li');
      li.className = 'queue-empty';
      li.textContent = 'No one waiting';
      this.queueList.appendChild(li);
      return;
    }
    names.forEach((name, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="queue-position">${i + 1}.</span> ${this.escapeHtml(name)}`;
      this.queueList.appendChild(li);
    });
  },

  playDoorbell() {
    try {
      if (!this.doorbellAudioCtx) {
        this.doorbellAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = this.doorbellAudioCtx;
      const now = ctx.currentTime;

      // Two-tone doorbell: ding-dong
      const frequencies = [659, 523]; // E5, C5
      const durations = [0.15, 0.25];
      let offset = 0;

      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + durations[i] + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + durations[i] + 0.15);
        offset += durations[i] + 0.05;
      });
    } catch (e) {
      // Audio not supported or blocked - silently ignore
    }
  },

  updateGameTimer(ms) {
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    const pad = (n) => String(n).padStart(2, '0');
    this.gameTimer.textContent = `${pad(mins)}:${pad(remainSecs)}`;
    this.gameTimer.classList.remove('hidden');
  },

  hideGameTimer() {
    this.gameTimer.classList.add('hidden');
  },

  formatTime(ms) {
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    if (mins > 0) return `${mins}m ${remainSecs}s`;
    return `${remainSecs}s`;
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },
};
