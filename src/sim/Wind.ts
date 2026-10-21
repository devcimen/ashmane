import type { Rng } from '../core/random';
import {
  WIND_CHANGE_INTERVAL_MAX,
  WIND_CHANGE_INTERVAL_MIN,
  WIND_CHANGE_MAX,
  WIND_GUST,
  WIND_STRENGTH,
  WIND_TURN_RATE,
} from './balance';


/**
 * Wind over the forest: a direction that slowly swings around and a gusty strength.
 * Pure logic; the fire spreads faster downwind and embers fly with it.
 */
export class Wind {
  /** Direction the wind blows towards (radians, atan2(z, x)). */
  angle: number;
  strength: number;
  private target: number;
  private untilChange: number;
  private time = 0;

  constructor(
    private readonly rng: Rng,
    private readonly baseStrength = WIND_STRENGTH,
  ) {
    this.angle = rng() * Math.PI * 2;
    this.target = this.angle;
    this.untilChange = this.nextInterval();
    this.strength = baseStrength;
  }

  /** Unit vector of the direction the wind blows towards. */
  get dirX(): number {
    return Math.cos(this.angle);
  }

  get dirZ(): number {
    return Math.sin(this.angle);
  }

  update(dt: number): void {
    this.time += dt;
    this.untilChange -= dt;
    if (this.untilChange <= 0) {
      this.target = this.angle + (this.rng() * 2 - 1) * WIND_CHANGE_MAX;
      this.untilChange = this.nextInterval();
    }
    const diff = Math.atan2(Math.sin(this.target - this.angle), Math.cos(this.target - this.angle));
    const step = WIND_TURN_RATE * dt;
    this.angle += Math.max(-step, Math.min(step, diff));

    const gust = Math.sin(this.time * 0.7) * 0.6 + Math.sin(this.time * 1.9 + 1.3) * 0.4;
    this.strength = this.baseStrength * (1 + WIND_GUST * gust);
  }

  private nextInterval(): number {
    return WIND_CHANGE_INTERVAL_MIN + this.rng() * (WIND_CHANGE_INTERVAL_MAX - WIND_CHANGE_INTERVAL_MIN);
  }
}
