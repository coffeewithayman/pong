# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start              # Production server on port 3000
npm run dev            # Dev server with auto-reload (node --watch)
npm test               # Run all tests (unit + e2e)
npm run test:unit      # Unit tests only (node --test)
npm run test:e2e       # E2E tests only (playwright)
```

Run a single unit test:
```bash
node --test tests/unit/GameEngine.test.js
```

Run a single e2e test:
```bash
npx playwright test tests/e2e/game.spec.js
```

## Architecture

Real-time multiplayer Pong game with server-authoritative physics. Express + Socket.IO backend serves a vanilla JS frontend.

### Server (`src/`)

- **GameManager** — Orchestrates the entire game: manages two active player slots (left=champion, right=challenger), coordinates GameEngine, GameLoop, PlayerQueue, and Leaderboard.
- **GameEngine** — Pure physics simulation: ball movement, paddle collision, wall bounce, speed acceleration, scoring detection. Returns `{ state, scored }` each tick.
- **GameLoop** — 60 FPS `setInterval` that calls `engine.tick()` and broadcasts state via callback to GameManager.
- **PlayerQueue** — FIFO queue for waiting players with duplicate prevention by socketId.
- **Leaderboard** — Persists top 10 entries (sorted by survival time) to `data/leaderboard.json`.
- **Socket handlers** (`src/socket/handlers.js`) — Wires Socket.IO events to GameManager methods.

### Client (`public/js/`)

- **main.js** — IIFE entry point, sets up Socket.IO listeners, maintains local state.
- **renderer.js**, **input.js**, **ui.js** — Singleton objects initialized via `.init()`. Renderer handles DPR-aware canvas scaling; Input abstracts keyboard + touch; UI manages modals and status displays.

### Game Flow

1. Two players join → assigned to left/right slots → game starts
2. GameLoop ticks at 60fps, broadcasts state to all clients in `game` room
3. Player loses → stats recorded to leaderboard → 1.5s pause → loser removed
4. Right player promoted to left (champion), next queued player fills right slot

### Client-Server Communication

Clients send only direction input (`-1`, `0`, `1`). All physics runs server-side. State broadcasts go to entire `game` room (players + spectators).

## Testing

- **Unit tests** use Node.js native `node:test` + `assert` — test physics and data structures directly without networking.
- **E2E tests** use Playwright in serial mode on port 3001 with `NODE_ENV=test`.
- Test mode exposes `POST /test/score` (force a score) and `POST /test/reset` (reset all state) for deterministic test orchestration.

## Key Conventions

- Server uses ES6 classes with callback-based dependency injection (e.g., GameLoop takes `onTick` callback).
- Client uses plain singleton objects (not classes) — no module bundler, script loading order matters (see `index.html`).
- Left slot = champion (survives longest), right slot = challenger (rotates in from queue).
- Default branch is `main`.
