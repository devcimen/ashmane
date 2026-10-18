import type { Rng } from '../core/random';
import { WORLD_HALF } from './world';

export type TreeType = 'pine' | 'broadleaf';

export interface Tree {
  x: number;
  z: number;
  scale: number;
  /** Rotation around the Y axis, in radians. */
  rotation: number;
  type: TreeType;
}

const TREE_COUNT = 120;
const MAX_ATTEMPTS = 5000;
const MIN_SPACING_SQ = 5.8;
const CLEAR_RADIUS = 5;
const EDGE_MARGIN = 1.4;

/** Generates the tree layout for one run from a seeded RNG. */
export class Forest {
  readonly trees: Tree[] = [];

  constructor(rng: Rng) {
    const span = WORLD_HALF - EDGE_MARGIN;
    for (let n = 0; n < MAX_ATTEMPTS && this.trees.length < TREE_COUNT; n++) {
      const x = (rng() * 2 - 1) * span;
      const z = (rng() * 2 - 1) * span;
      // Keep the start area around the origin free.
      if (Math.hypot(x, z) < CLEAR_RADIUS) continue;
      if (this.trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < MIN_SPACING_SQ)) continue;
      this.trees.push({
        x,
        z,
        scale: 0.85 + rng() * 0.6,
        rotation: rng() * Math.PI * 2,
        type: rng() < 0.5 ? 'pine' : 'broadleaf',
      });
    }
  }
}
