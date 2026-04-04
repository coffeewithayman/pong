// UI manager for status, leaderboard, and modals
const UI = {
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
    this.playAgainBtn = document.getElementById('play-again-btn');
  },

  showNameModal(onJoin, onSpectate) {
    this.nameModal.classList.remove('hidden');
    this.gameContainer.classList.remove('active');
    this.nameInput.focus();

    const submit = () => {
      const name = this.nameInput.value.trim();
      if (name) {
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
    this.hidePlayAgain();
  },

  showPlayAgain(callback) {
    this.playAgainBtn.classList.remove('hidden');
    this.playAgainBtn.onclick = () => {
      this.hidePlayAgain();
      callback();
    };
  },

  hidePlayAgain() {
    this.playAgainBtn.classList.add('hidden');
    this.playAgainBtn.onclick = null;
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
    } else {
      this.playerLeftLabel.textContent = '';
    }
    if (playerInfo && playerInfo.right) {
      this.playerRightLabel.textContent = `${playerInfo.right.name} [${playerInfo.right.points}]`;
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
