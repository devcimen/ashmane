import type { Rng } from '../core/random';
import { FOREST_RADIUS_MAX, FOREST_RADIUS_MIN } from './world';

/** Number of overlaid waves that shape the edge; more = more wobbly. */
const HARMONICS = 4;

/**
 * Irregular closed outline of the forest around the origin. The distance to the edge
 * depends on the direction: a sum of a few sine waves with random phases and strengths,
 * mapped into [FOREST_RADIUS_MIN, FOREST_RADIUS_MAX].
 */
export class ForestEdge {
  private readonly amplitudes: number[] = [];
  private readonly phases: number[] = [];

  constructor(rng: Rng) {
    let total = 0;
    for (let k = 1; k <= HARMONICS; k++) {
      // Lower harmonics dominate, so the shape stays a blob instead of a star.
      const a = (0.4 + rng() * 0.6) / k;
      this.amplitudes.push(a);
      this.phases.push(rng() * Math.PI * 2);
      total += a;
    }
    for (let i = 0; i < this.amplitudes.length; i++) this.amplitudes[i] /= total;
  }

  /** Distance from the origin to the edge in the given direction (radians, atan2(z, x)). */
  radiusAt(angle: number): number {
    let v = 0;
    for (let i = 0; i < this.amplitudes.length; i++) {
      v += this.amplitudes[i] * Math.sin((i + 1) * angle + this.phases[i]);
    }
    // v is in [-1, 1] because the amplitudes sum to 1.
    return FOREST_RADIUS_MIN + (FOREST_RADIUS_MAX - FOREST_RADIUS_MIN) * (0.5 + 0.5 * v);
  }

  /** Signed distance to the edge: positive inside the forest, negative outside. */
  distanceInside(x: number, z: number): number {
    return this.radiusAt(Math.atan2(z, x)) - Math.hypot(x, z);
  }

  contains(x: number, z: number): boolean {
    return this.distanceInside(x, z) > 0;
  }

  /** Approximate enclosed area, integrated over the angle. */
  area(steps = 360): number {
    let sum = 0;
    for (let i = 0; i < steps; i++) sum += this.radiusAt((i / steps) * Math.PI * 2) ** 2;
    return 0.5 * sum * ((Math.PI * 2) / steps);
  }
}
