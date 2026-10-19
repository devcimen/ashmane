import type { Rng } from '../core/random';
import type { Collision, Forest } from './Forest';
import { CELL_SIZE, GRID_SIZE, WORLD_HALF } from './world';

export const CellState = {
  Fresh: 0,
  Burning: 1,
  Burnt: 2,
} as const;
export type CellState = (typeof CellState)[keyof typeof CellState];

/** Number of places where the fire starts. */
const ORIGIN_COUNT = 3;
/** Distance range of the fire origins from the start (origin). */
const ORIGIN_DISTANCE_MIN = 15;
const ORIGIN_DISTANCE_MAX = 30;
/** Chance per second that a burning cell sets a direct neighbour alight, at the start of a run. */
const SPREAD_RATE = 0.2;
/** How much faster the spreading gets per second of run time (0.02 = +2 % per second). */
const SPREAD_GROWTH = 0.02;
/** Trees catch fire more easily than bare ground. */
const TREE_CATCH_FACTOR = 2.5;
/** Diagonal neighbours are further away, so they catch less often. */
const DIAGONAL_FACTOR = 0.7;
/** Burn duration ranges in seconds. */
const GROUND_BURN_MIN = 6;
const GROUND_BURN_MAX = 9;
const TREE_BURN_MIN = 13;
const TREE_BURN_MAX = 18;
/** Seconds until a fresh fire reaches full strength, and before burning out it fades. */
const FLARE_UP = 1.2;
const DIE_DOWN = 2.2;
/** Seconds until a fresh fire spreads at full rate. */
const SPREAD_RAMP = 1.5;
/** Burning cells block movement once their intensity is above this. */
const BLOCK_INTENSITY = 0.3;
/** Burning cells within this distance radiate heat. */
export const HEAT_RADIUS = 3;

/** Fire simulation on a square cell grid covering the world. Pure logic, no rendering. */
export class FireGrid {
  readonly size = GRID_SIZE;
  readonly state = new Uint8Array(GRID_SIZE * GRID_SIZE);
  /** Seconds since the cell caught fire. */
  readonly age = new Float32Array(GRID_SIZE * GRID_SIZE);
  /** How long the cell burns in total. */
  readonly duration = new Float32Array(GRID_SIZE * GRID_SIZE);
  /** Index into forest.trees for cells with a tree, otherwise -1. */
  readonly cellTree = new Int32Array(GRID_SIZE * GRID_SIZE).fill(-1);
  /** Cells currently burning. */
  burning: number[] = [];
  /** Cells that burnt out during the last update. */
  burntOut: number[] = [];
  /** Run time in seconds; drives the growing spread rate. */
  elapsed = 0;

  constructor(
    private readonly forest: Forest,
    private readonly rng: Rng,
  ) {
    forest.trees.forEach((tree, i) => {
      const c = this.cellOf(tree.x, tree.z);
      if (c >= 0) this.cellTree[c] = i;
    });
    this.igniteOrigins();
  }

  /** Cell index for a world position, or -1 outside the grid. */
  cellOf(x: number, z: number): number {
    const i = Math.floor((x + WORLD_HALF) / CELL_SIZE);
    const j = Math.floor((z + WORLD_HALF) / CELL_SIZE);
    if (i < 0 || j < 0 || i >= this.size || j >= this.size) return -1;
    return j * this.size + i;
  }

  cellX(c: number): number {
    return ((c % this.size) + 0.5) * CELL_SIZE - WORLD_HALF;
  }

  cellZ(c: number): number {
    return (Math.floor(c / this.size) + 0.5) * CELL_SIZE - WORLD_HALF;
  }

  ignite(c: number): void {
    if (this.state[c] !== CellState.Fresh) return;
    const tree = this.cellTree[c] >= 0;
    this.state[c] = CellState.Burning;
    this.age[c] = 0;
    this.duration[c] = tree
      ? TREE_BURN_MIN + this.rng() * (TREE_BURN_MAX - TREE_BURN_MIN)
      : GROUND_BURN_MIN + this.rng() * (GROUND_BURN_MAX - GROUND_BURN_MIN);
    this.burning.push(c);
  }

  /** Flame strength of a cell in [0, 1]: flares up, holds, then dies down. */
  intensity(c: number): number {
    if (this.state[c] !== CellState.Burning) return 0;
    const up = Math.min(1, this.age[c] / FLARE_UP);
    const down = Math.min(1, (this.duration[c] - this.age[c]) / DIE_DOWN);
    return Math.max(0, up * down);
  }

  update(dt: number): void {
    this.elapsed += dt;
    const rate = SPREAD_RATE * (1 + this.elapsed * SPREAD_GROWTH);
    const list = this.burning;
    this.burning = [];
    this.burntOut = [];

    for (const c of list) {
      this.age[c] += dt;
      if (this.age[c] >= this.duration[c]) {
        this.burnOut(c);
        continue;
      }
      this.burning.push(c);
      const ramp = Math.min(1, this.age[c] / SPREAD_RAMP);
      const ci = c % this.size;
      const cj = Math.floor(c / this.size);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (di === 0 && dj === 0) continue;
          const ni = ci + di;
          const nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= this.size || nj >= this.size) continue;
          const nc = nj * this.size + ni;
          if (this.state[nc] !== CellState.Fresh) continue;
          const tree = this.cellTree[nc] >= 0 ? TREE_CATCH_FACTOR : 1;
          const diagonal = di !== 0 && dj !== 0 ? DIAGONAL_FACTOR : 1;
          if (this.rng() < rate * dt * ramp * tree * diagonal) this.ignite(nc);
        }
      }
    }
  }

  /** Heat at a position: sum of nearby flame intensities, falling off with distance. */
  heatAt(x: number, z: number): number {
    let heat = 0;
    this.forEachCellNear(x, z, HEAT_RADIUS, (c) => {
      const k = this.intensity(c);
      if (k <= 0) return;
      const d = Math.hypot(this.cellX(c) - x, this.cellZ(c) - z);
      if (d < HEAT_RADIUS) heat += k * (1 - d / HEAT_RADIUS) ** 2;
    });
    return heat;
  }

  /** Pushes a circle out of strongly burning cells (treated as squares). Null when nothing was hit. */
  collide(x: number, z: number, radius: number): Collision | null {
    let nx = 0;
    let nz = 0;
    let hit = false;
    const half = CELL_SIZE / 2;
    this.forEachCellNear(x, z, radius + CELL_SIZE, (c) => {
      if (this.intensity(c) < BLOCK_INTENSITY) return;
      const cx = this.cellX(c);
      const cz = this.cellZ(c);
      // Closest point of the cell square to the circle centre.
      const px = Math.max(cx - half, Math.min(x, cx + half));
      const pz = Math.max(cz - half, Math.min(z, cz + half));
      let dx = x - px;
      let dz = z - pz;
      let d = Math.hypot(dx, dz);
      if (d >= radius) return;
      if (d < 1e-6) {
        // Centre is inside the square: leave along the shortest way out.
        const ox = x - cx;
        const oz = z - cz;
        if (Math.abs(ox) > Math.abs(oz)) [dx, dz] = [Math.sign(ox) || 1, 0];
        else [dx, dz] = [0, Math.sign(oz) || 1];
        x = dx !== 0 ? cx + dx * (half + radius) : x;
        z = dz !== 0 ? cz + dz * (half + radius) : z;
        d = 1;
      } else {
        x = px + (dx / d) * radius;
        z = pz + (dz / d) * radius;
      }
      nx += dx / d;
      nz += dz / d;
      hit = true;
    });
    if (!hit) return null;
    const len = Math.hypot(nx, nz) || 1;
    return { x, z, nx: nx / len, nz: nz / len };
  }

  private burnOut(c: number): void {
    this.state[c] = CellState.Burnt;
    this.burntOut.push(c);
    const t = this.cellTree[c];
    if (t >= 0) this.forest.trees[t].charred = true;
  }

  /** Each origin lights a small 3×3 patch so it reliably takes hold. */
  private igniteOrigins(): void {
    for (let n = 0; n < ORIGIN_COUNT; n++) {
      const angle = this.rng() * Math.PI * 2;
      const dist = ORIGIN_DISTANCE_MIN + this.rng() * (ORIGIN_DISTANCE_MAX - ORIGIN_DISTANCE_MIN);
      const centre = this.cellOf(Math.cos(angle) * dist, Math.sin(angle) * dist);
      if (centre < 0) continue;
      const ci = centre % this.size;
      const cj = Math.floor(centre / this.size);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) this.ignite((cj + dj) * this.size + (ci + di));
      }
    }
  }

  private forEachCellNear(x: number, z: number, radius: number, fn: (c: number) => void): void {
    const i0 = Math.max(0, Math.floor((x - radius + WORLD_HALF) / CELL_SIZE));
    const i1 = Math.min(this.size - 1, Math.floor((x + radius + WORLD_HALF) / CELL_SIZE));
    const j0 = Math.max(0, Math.floor((z - radius + WORLD_HALF) / CELL_SIZE));
    const j1 = Math.min(this.size - 1, Math.floor((z + radius + WORLD_HALF) / CELL_SIZE));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) fn(j * this.size + i);
    }
  }
}
