/** Units per second at full gallop. */
export const MAX_SPEED = 8;
/** How quickly speed approaches its target while a direction is held (1/s). Higher = snappier. */
const SPEED_RESPONSE = 3.5;
/** How quickly the horse coasts to a stop when no direction is held (1/s). */
const BRAKE_RESPONSE = 3;
/** Below this speed a coasting horse comes to a full stop. */
const STOP_SPEED = 0.05;
/** Turning rate when standing or walking (radians/s): can turn almost on the spot. */
const TURN_SLOW = 6;
/** Turning rate at full gallop (radians/s): only wide arcs. */
const TURN_FAST = 2.5;
/** Lowest speed factor in sharp turns; a U-turn slows down to this share of MAX_SPEED. */
const CORNER_SPEED_MIN = 0.25;
/** Size of the horse as a circle on the ground, for collisions. */
export const HORSE_RADIUS = 0.45;

export const MAX_HEALTH = 100;
/** Health lost per second per unit of heat (one full-strength flame right next to the horse ≈ 1). */
const DAMAGE_PER_HEAT = 8;
/** Extra damage per second spent in the heat without a break (0.5 = +50 % per second). */
const EXPOSURE_GAIN = 0.5;
/** Exposure stops growing after this many seconds. */
const EXPOSURE_MAX = 4;
/** Seconds of exposure that wear off per second out of the heat. */
const EXPOSURE_RECOVERY = 1;

/**
 * Horse state on the ground plane. Pure logic, no rendering.
 * The horse always runs forward along its heading; the input only says where it wants to go.
 */
export class Horse {
  x = 0;
  z = 0;
  speed = 0;
  /**
   * Facing angle around the Y axis, in radians. 0 faces +X,
   * positive values turn towards -Z (same convention as Three.js rotation.y).
   */
  heading = 0;
  health = MAX_HEALTH;
  /** Seconds spent in the heat without a break; makes staying close to the fire worse and worse. */
  exposure = 0;

  private dirX = 0;
  private dirZ = 0;

  get alive(): boolean {
    return this.health > 0;
  }

  get vx(): number {
    return Math.cos(this.heading) * this.speed;
  }

  get vz(): number {
    return -Math.sin(this.heading) * this.speed;
  }

  /** Desired movement direction, normalized or (0, 0) for none. */
  setDirection(x: number, z: number): void {
    this.dirX = x;
    this.dirZ = z;
  }

  update(dt: number): void {
    const wantsToMove = this.dirX !== 0 || this.dirZ !== 0;
    const targetSpeed = wantsToMove ? this.steer(dt) : 0;
    this.updateSpeed(targetSpeed, wantsToMove ? SPEED_RESPONSE : BRAKE_RESPONSE, dt);
    this.x += this.vx * dt;
    this.z += this.vz * dt;
  }

  /** Takes damage from the heat at its position; the longer it stays in the heat, the more it hurts. */
  applyHeat(heat: number, dt: number): void {
    if (heat > 0) {
      this.exposure = Math.min(EXPOSURE_MAX, this.exposure + dt);
      this.health -= heat * DAMAGE_PER_HEAT * (1 + this.exposure * EXPOSURE_GAIN) * dt;
      this.health = Math.max(0, this.health);
    } else {
      this.exposure = Math.max(0, this.exposure - EXPOSURE_RECOVERY * dt);
    }
  }

  /**
   * Reacts to running into an obstacle whose surface points along (nx, nz).
   * Head-on loses all speed, grazing keeps most of it, so the horse slides along.
   */
  bump(nx: number, nz: number): void {
    const into = -(Math.cos(this.heading) * nx - Math.sin(this.heading) * nz);
    if (into <= 0) return;
    this.speed *= Math.sqrt(Math.max(0, 1 - into * into));
  }

  /** Turns towards the desired direction and returns the speed the horse aims for. */
  private steer(dt: number): number {
    const desired = Math.atan2(-this.dirZ, this.dirX);
    const t = Math.min(1, this.speed / MAX_SPEED);
    const maxStep = (TURN_SLOW + (TURN_FAST - TURN_SLOW) * t) * dt;
    this.heading += clamp(angleDiff(desired, this.heading), -maxStep, maxStep);
    // The further the horse still has to turn, the more it slows down.
    const remaining = angleDiff(desired, this.heading);
    return MAX_SPEED * clamp(Math.cos(remaining), CORNER_SPEED_MIN, 1);
  }

  /** Exponential approach: quick start, soft settling, smooth coasting. */
  private updateSpeed(target: number, response: number, dt: number): void {
    this.speed += (target - this.speed) * (1 - Math.exp(-response * dt));
    if (target === 0 && this.speed < STOP_SPEED) this.speed = 0;
  }
}

/** Signed shortest difference a - b, in (-PI, PI]. */
function angleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
