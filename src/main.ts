import { Game } from './core/Game';
import { randomSeed } from './core/random';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app container');

const seed = randomSeed();
console.info(`Ashmane seed: ${seed}`);
new Game(container, seed).start();
