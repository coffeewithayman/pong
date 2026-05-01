// Input handler for keyboard and touch controls
const Input = {
  socket: null,
  currentDirection: 0,
  isPlayer: false,

  init(socket) {
    this.socket = socket;
    this.setupKeyboard();
    this.setupTouch();
  },

  setupKeyboard() {
    const pressed = {};

    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        pressed[e.key] = true;
        this.updateDirection(pressed);
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        pressed[e.key] = false;
        this.updateDirection(pressed);
      }
    });

    this._pressed = pressed;
  },

  setupTouch() {
    const btnUp = document.getElementById('btn-up');
    const btnDown = document.getElementById('btn-down');

    const startUp = (e) => { e.preventDefault(); this.sendDirection(-1); };
    const startDown = (e) => { e.preventDefault(); this.sendDirection(1); };
    const stop = (e) => { e.preventDefault(); this.sendDirection(0); };

    // Touch events
    btnUp.addEventListener('touchstart', startUp, { passive: false });
    btnUp.addEventListener('touchend', stop, { passive: false });
    btnUp.addEventListener('touchcancel', stop, { passive: false });

    btnDown.addEventListener('touchstart', startDown, { passive: false });
    btnDown.addEventListener('touchend', stop, { passive: false });
    btnDown.addEventListener('touchcancel', stop, { passive: false });

    // Mouse fallback
    btnUp.addEventListener('mousedown', startUp);
    btnUp.addEventListener('mouseup', stop);
    btnUp.addEventListener('mouseleave', stop);

    btnDown.addEventListener('mousedown', startDown);
    btnDown.addEventListener('mouseup', stop);
    btnDown.addEventListener('mouseleave', stop);
  },

  updateDirection(pressed) {
    let dir = 0;
    if (pressed['ArrowUp'] && !pressed['ArrowDown']) dir = -1;
    else if (pressed['ArrowDown'] && !pressed['ArrowUp']) dir = 1;
    this.sendDirection(dir);
  },

  sendDirection(dir) {
    if (dir !== this.currentDirection) {
      this.currentDirection = dir;
      if (this.socket && this.isPlayer) {
        this.socket.emit('input', { direction: dir });
      }
    }
  },

  setPlayerState(isPlayer) {
    this.isPlayer = isPlayer;
    if (!isPlayer) {
      this.currentDirection = 0;
    }
  },

  setControlColor(color) {
    const btnUp = document.getElementById('btn-up');
    const btnDown = document.getElementById('btn-down');
    if (color) {
      btnUp.style.borderColor = color;
      btnUp.style.color = color;
      btnDown.style.borderColor = color;
      btnDown.style.color = color;
    } else {
      btnUp.style.borderColor = '';
      btnUp.style.color = '';
      btnDown.style.borderColor = '';
      btnDown.style.color = '';
    }
  },
};
