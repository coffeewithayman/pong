# 🏓 Pong Online

[![Node.js](https://img.shields.io/badge/Node.js-22%2B-brightgreen?logo=node.js)](https://nodejs.org)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-black?logo=socket.io)](https://socket.io)
![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)


A real-time multiplayer Pong game with a queue system, persistent leaderboard, and spectator mode — playable in the browser with no installs required.

## 🎮 <a href="https://pong.best" target="_blank">[Play it live →]</a>

> If you find this fun or useful, consider giving it a ⭐ — it helps others find the project!

---

## Features

- **Real-time multiplayer** — Two players compete with server-authoritative physics at 60fps
- **Queue system** — Players wait in line and rotate in as challengers; the winner stays as champion
- **Leaderboard** — Tracks top 10 players by survival time, persisted across restarts
- **Spectator mode** — Anyone can watch live matches in progress
- **Mobile support** — Touch controls with a responsive layout for phones and tablets
- **Zero dependencies on the client** — Vanilla JS, no frameworks, runs in any modern browser

## Getting Started

**Prerequisites:** Node.js 22+

```bash
git clone https://github.com/coffeewithayman/pong.git
cd pong
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser. Open a second tab to get a game going.

## How to Play

1. Enter your name and click **Join**
2. If two players are connected, the game starts automatically
3. Use **Arrow Up / Arrow Down** to move your paddle (or touch buttons on mobile)
4. The losing player is replaced by the next person in the queue
5. Outlast everyone to top the leaderboard

## Running Tests

```bash
npm run test:unit    # Unit tests (Node.js built-in test runner)
npm run test:e2e     # End-to-end tests (Playwright)
npm test             # Both
```

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js, Express, Socket.IO |
| Client | Vanilla JS, Canvas API |
| Testing | Node.js `node:test`, Playwright |

## Contributing

Pull requests are welcome! For major changes, open an issue first to discuss what you'd like to change.
