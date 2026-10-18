/** Units per second at full gallop. */
const MAX_SPEED = 8;
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

  private dirX = 0;
  private dirZ = 0;

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
