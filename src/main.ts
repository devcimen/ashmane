import { Game } from './core/Game';
import { randomSeed } from './core/random';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container');

// ?seed=123 replays a specific forest; otherwise every load gets a new one.
const seedParam = new URLSearchParams(location.search).get('seed');
const seed = seedParam !== null && /^\d+$/.test(seedParam) ? Number(seedParam) : randomSeed();
new Game(container, seed).start();
