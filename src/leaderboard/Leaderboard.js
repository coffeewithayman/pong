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

const fs = require('fs');
const path = require('path');
const C = require('../game/constants');

class Leaderboard {
  constructor(filePath) {
    this.filePath = filePath || path.join(__dirname, '../../data/leaderboard.json');
    this.entries = this.load();
  }

  load() {
    try {
      const data = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  save() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2));
  }

  addEntry(name, survivalMs, points) {
    this.entries.push({
      name,
      survivalMs,
      points,
      date: new Date().toISOString(),
    });
    this.entries.sort((a, b) => b.survivalMs - a.survivalMs);
    this.entries = this.entries.slice(0, C.LEADERBOARD_SIZE);
    this.save();
    return this.entries;
  }

  getTop(n) {
    return this.entries.slice(0, n || C.LEADERBOARD_SIZE);
  }
}

module.exports = Leaderboard;
