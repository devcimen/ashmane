# Changelog

All notable changes to Ashmane. Versions follow [Semantic Versioning](https://semver.org):
patch for fixes and balance, minor for new features, major once version 1 of the idea is complete.

## [0.1.0] – 2026-10-21

The first playable version.

### Gameplay
- Play Almaas, a cotton-candy-pink horse who wakes up in a burning forest and has to escape.
- Every run grows a new random forest with an irregular edge 90–150 units from the start.
- Steering with WASD or the arrow keys: the horse runs forward along its heading, turns in arcs, slows down in sharp turns and coasts to a stop.
- Trees block the way; charred trees leave only their trunk in the way.
- Fire spreads from cell to cell. Big fires start around the middle, and a ring of fires near the edge flares up one after another and closes the exits.
- Wind slowly turns and drives the fire: downwind it races, upwind it barely moves.
- Ember spotting: burning trees throw embers downwind, and embers land ahead of the running horse to start new fires.
- Health: heat hurts, more inside the flames and near burning trees, and more the longer you stay in it.
- Burnt ground swallows the horse if it stands still or dawdles; galloping across is fine.
- Escape by crossing the forest edge, marked by a dashed pink line and floating pink lights.

### Presentation
- Ordered Bayer dither on a small render target, reduced to black, white, dark red (fire) and pink (horse).
- Animated low-poly horse with a flowing tail, leaning into turns.
- Flames lean with the wind, embers fly in arcs, burnt ground darkens.
- Feedback on damage: white flash, a startled hop and a light camera shake.
- Start screen with the ASHMANE title and a short story with the controls.
- Waking-up scene at the start; death animations for burning and sinking; the world fades to grey at the end of a run.
- Health bar and wind arrow; restart with Enter for a new forest.

### Development
- Vite, TypeScript and Three.js, no other runtime dependencies.
- Simulation separated from rendering and covered by unit tests (`npm test`).
- All gameplay values in `src/sim/balance.ts`; `npm run balance` lets a bot play 160 runs to compare difficulty.
- `?seed=123` in the URL replays a specific forest.
