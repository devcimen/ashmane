import type { Rng } from '../core/random';

/** Seconds between new target directions. */
const CHANGE_INTERVAL_MIN = 15;
const CHANGE_INTERVAL_MAX = 35;
/** Largest change of the target direction at once (radians, ±). */
const CHANGE_MAX = Math.PI / 2;
/** How fast the wind turns towards its target direction (radians/s). */
const TURN_RATE = 0.12;
/** Average strength; 1 is a normal wind, 0 is calm. */
export const WIND_STRENGTH = 1;
/** Gusts: strength wobbles by this share around the average. */
const GUST_AMOUNT = 0.3;

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
      this.target = this.angle + (this.rng() * 2 - 1) * CHANGE_MAX;
      this.untilChange = this.nextInterval();
    }
    const diff = Math.atan2(Math.sin(this.target - this.angle), Math.cos(this.target - this.angle));
    const step = TURN_RATE * dt;
    this.angle += Math.max(-step, Math.min(step, diff));

    const gust = Math.sin(this.time * 0.7) * 0.6 + Math.sin(this.time * 1.9 + 1.3) * 0.4;
    this.strength = this.baseStrength * (1 + GUST_AMOUNT * gust);
  }

  private nextInterval(): number {
    return CHANGE_INTERVAL_MIN + this.rng() * (CHANGE_INTERVAL_MAX - CHANGE_INTERVAL_MIN);
  }
}
