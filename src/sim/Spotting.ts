import type { Rng } from '../core/random';
import {
  AHEAD_DISTANCE_MAX,
  AHEAD_DISTANCE_MIN,
  AHEAD_FIRE_RANGE,
  AHEAD_INTERVAL_MAX,
  AHEAD_INTERVAL_MIN,
  AHEAD_MIN_SPEED,
  AHEAD_SAFE_DISTANCE,
  AHEAD_SPREAD,
  FLIGHT_SPEED,
  SPOT_PATCH_RADIUS,
  TREE_SPOT_DISTANCE_MAX,
  TREE_SPOT_DISTANCE_MIN,
  TREE_SPOT_INTENSITY,
  TREE_SPOT_RATE,
  TREE_SPOT_SPREAD,
} from './balance';
import { CellState, type FireGrid } from './FireGrid';
import type { Forest } from './Forest';
import type { Horse } from './Horse';
import type { Wind } from './Wind';


export interface Ember {
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  /** Seconds in the air so far, and in total. */
  age: number;
  duration: number;
}

/**
 * Ember spotting: burning trees throw embers downwind, and now and then an ember lands
 * ahead of the running horse. Embers fly for a moment and start a small fire where they land.
 */
export class Spotting {
  /** Embers currently in the air. */
  readonly inFlight: Ember[] = [];
  private untilAhead: number;

  constructor(
    private readonly fire: FireGrid,
    private readonly forest: Forest,
    private readonly wind: Wind,
    private readonly rng: Rng,
  ) {
    this.untilAhead = this.nextAheadInterval();
  }

  update(dt: number, horse: Horse): void {
    this.land(dt);
    this.throwFromTrees(dt);
    this.untilAhead -= dt;
    if (this.untilAhead <= 0) {
      this.untilAhead = this.nextAheadInterval();
      this.throwAhead(horse);
    }
  }

  private land(dt: number): void {
    for (let i = this.inFlight.length - 1; i >= 0; i--) {
      const e = this.inFlight[i];
      e.age += dt;
      if (e.age < e.duration) continue;
      this.inFlight.splice(i, 1);
      const cell = this.fire.cellOf(e.toX, e.toZ);
      if (cell >= 0) this.fire.ignitePatch(cell, SPOT_PATCH_RADIUS);
    }
  }

  private throwFromTrees(dt: number): void {
    const { fire } = this;
    for (const c of fire.burning) {
      if (fire.cellTree[c] < 0 || fire.intensity(c) < TREE_SPOT_INTENSITY) continue;
      if (this.rng() >= TREE_SPOT_RATE * this.wind.strength * dt) continue;
      const angle = this.wind.angle + (this.rng() * 2 - 1) * TREE_SPOT_SPREAD;
      const dist = lerp(TREE_SPOT_DISTANCE_MIN, TREE_SPOT_DISTANCE_MAX, this.rng());
      const x = fire.cellX(c);
      const z = fire.cellZ(c);
      this.launch(x, z, x + Math.cos(angle) * dist, z + Math.sin(angle) * dist);
    }
  }

  /** Sends an ember from the nearest fire to a spot ahead of the horse, if one is close enough. */
  private throwAhead(horse: Horse): void {
    if (horse.speed < AHEAD_MIN_SPEED) return;
    const source = this.nearestFire(horse.x, horse.z, AHEAD_FIRE_RANGE);
    if (source < 0) return;
    const angle = Math.atan2(horse.vz, horse.vx) + (this.rng() * 2 - 1) * AHEAD_SPREAD;
    const dist = lerp(AHEAD_DISTANCE_MIN, AHEAD_DISTANCE_MAX, this.rng());
    const toX = horse.x + Math.cos(angle) * dist;
    const toZ = horse.z + Math.sin(angle) * dist;
    if (Math.hypot(toX - horse.x, toZ - horse.z) < AHEAD_SAFE_DISTANCE) return;
    if (!this.forest.edge.contains(toX, toZ)) return;
    this.launch(this.fire.cellX(source), this.fire.cellZ(source), toX, toZ);
  }

  private launch(fromX: number, fromZ: number, toX: number, toZ: number): void {
    const target = this.fire.cellOf(toX, toZ);
    if (target < 0 || this.fire.state[target] !== CellState.Fresh) return;
    const duration = Math.hypot(toX - fromX, toZ - fromZ) / FLIGHT_SPEED;
    this.inFlight.push({ fromX, fromZ, toX, toZ, age: 0, duration });
  }

  private nearestFire(x: number, z: number, range: number): number {
    let best = -1;
    let bestD2 = range * range;
    for (const c of this.fire.burning) {
      const d2 = (this.fire.cellX(c) - x) ** 2 + (this.fire.cellZ(c) - z) ** 2;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = c;
      }
    }
    return best;
  }

  private nextAheadInterval(): number {
    return lerp(AHEAD_INTERVAL_MIN, AHEAD_INTERVAL_MAX, this.rng());
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
