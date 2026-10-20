import type { Rng } from '../core/random';
import type { Forest } from './Forest';
import { CELL_SIZE, GRID_SIZE, WORLD_HALF } from './world';

export const CellState = {
  Fresh: 0,
  Burning: 1,
  Burnt: 2,
} as const;
export type CellState = (typeof CellState)[keyof typeof CellState];

/** Inner ring: big fires around the start that burn from the first second. */
const INNER_ORIGIN_COUNT = 3;
const INNER_DISTANCE_MIN = 15;
const INNER_DISTANCE_MAX = 30;
/** Radius of the burning patch each inner origin starts with, in cells. */
const INNER_PATCH_RADIUS = 3;
/** Outer ring: small fires further out that flare up later, so escaping the middle is not the end. */
const OUTER_ORIGIN_COUNT_MIN = 2;
const OUTER_ORIGIN_COUNT_MAX = 3;
/** How far towards the forest edge the outer origins lie, as a share of the edge distance. */
const OUTER_DEPTH_MIN = 0.5;
const OUTER_DEPTH_MAX = 0.85;
const OUTER_PATCH_RADIUS = 1;
/** Seconds into the run when the outer origins flare up. */
const OUTER_DELAY_MIN = 10;
const OUTER_DELAY_MAX = 40;
/** Random deviation from evenly spaced directions (radians, ±). */
const ORIGIN_ANGLE_JITTER = 0.5;
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
/** Burning cells within this distance radiate heat. */
export const HEAT_RADIUS = 3;
/** A burning tree radiates this much more heat than burning ground. */
const TREE_HEAT_FACTOR = 1.6;
/** Heat multiplier when the cell under the horse is burning itself. */
const IN_FIRE_FACTOR = 2;

export interface ScheduledFire {
  /** Centre cell of the patch. */
  cell: number;
  /** Patch radius in cells. */
  radius: number;
  /** Run time in seconds when it flares up. */
  at: number;
}

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
  /** Fires that have not started yet, sorted by start time. */
  readonly scheduled: ScheduledFire[] = [];

  constructor(
    private readonly forest: Forest,
    private readonly rng: Rng,
  ) {
    forest.trees.forEach((tree, i) => {
      const c = this.cellOf(tree.x, tree.z);
      if (c >= 0) this.cellTree[c] = i;
    });
    this.placeOrigins();
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
    while (this.scheduled.length > 0 && this.scheduled[0].at <= this.elapsed) {
      const fire = this.scheduled.shift()!;
      this.ignitePatch(fire.cell, fire.radius);
    }
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

  /**
   * Heat at a position: sum of nearby flame intensities, falling off with distance.
   * Burning trees radiate more than burning ground, and standing right in the flames counts double.
   * A big fire therefore hurts much more than grazing a small one.
   */
  heatAt(x: number, z: number): number {
    let heat = 0;
    this.forEachCellNear(x, z, HEAT_RADIUS, (c) => {
      const k = this.intensity(c);
      if (k <= 0) return;
      const d = Math.hypot(this.cellX(c) - x, this.cellZ(c) - z);
      if (d >= HEAT_RADIUS) return;
      const source = this.cellTree[c] >= 0 ? TREE_HEAT_FACTOR : 1;
      heat += k * source * (1 - d / HEAT_RADIUS) ** 2;
    });
    const here = this.cellOf(x, z);
    if (here >= 0 && this.intensity(here) > 0) heat *= IN_FIRE_FACTOR;
    return heat;
  }

  private burnOut(c: number): void {
    this.state[c] = CellState.Burnt;
    this.burntOut.push(c);
    const t = this.cellTree[c];
    if (t >= 0) this.forest.trees[t].charred = true;
  }

  /**
   * Inner origins burn right away as big patches around the start. Outer origins lie
   * between them, further towards the edge, and are scheduled to flare up later.
   */
  private placeOrigins(): void {
    const base = this.rng() * Math.PI * 2;
    for (const angle of this.spreadAngles(base, INNER_ORIGIN_COUNT)) {
      const dist = lerp(INNER_DISTANCE_MIN, INNER_DISTANCE_MAX, this.rng());
      const cell = this.cellOf(Math.cos(angle) * dist, Math.sin(angle) * dist);
      if (cell >= 0) this.ignitePatch(cell, INNER_PATCH_RADIUS);
    }

    const outerCount = OUTER_ORIGIN_COUNT_MIN + Math.floor(this.rng() * (OUTER_ORIGIN_COUNT_MAX - OUTER_ORIGIN_COUNT_MIN + 1));
    // Offset by half a gap of the inner ring, so outer fires sit between the inner ones.
    for (const angle of this.spreadAngles(base + Math.PI / INNER_ORIGIN_COUNT, outerCount)) {
      const dist = this.forest.edge.radiusAt(angle) * lerp(OUTER_DEPTH_MIN, OUTER_DEPTH_MAX, this.rng());
      const cell = this.cellOf(Math.cos(angle) * dist, Math.sin(angle) * dist);
      const at = lerp(OUTER_DELAY_MIN, OUTER_DELAY_MAX, this.rng());
      if (cell >= 0) this.scheduled.push({ cell, radius: OUTER_PATCH_RADIUS, at });
    }
    this.scheduled.sort((a, b) => a.at - b.at);
  }

  /** `count` directions evenly spaced around the circle, each nudged a little at random. */
  private spreadAngles(base: number, count: number): number[] {
    return Array.from(
      { length: count },
      (_, k) => base + (k * Math.PI * 2) / count + (this.rng() * 2 - 1) * ORIGIN_ANGLE_JITTER,
    );
  }

  /** Lights a round patch of cells so a fire reliably takes hold. */
  private ignitePatch(centre: number, radius: number): void {
    const ci = centre % this.size;
    const cj = Math.floor(centre / this.size);
    for (let dj = -radius; dj <= radius; dj++) {
      for (let di = -radius; di <= radius; di++) {
        const i = ci + di;
        const j = cj + dj;
        if (di * di + dj * dj > radius * radius + radius) continue;
        if (i < 0 || j < 0 || i >= this.size || j >= this.size) continue;
        this.ignite(j * this.size + i);
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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
