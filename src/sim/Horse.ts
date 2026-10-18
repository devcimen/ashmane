/** Units per second at full gallop. */
const MAX_SPEED = 7;
/** How fast the horse gains speed while a direction is held (units/s²). */
const ACCELERATION = 20;
/** How fast it slows down when no direction is held (units/s²). */
const DECELERATION = 14;
/** Maximum turning rate of the body (radians/s). */
const TURN_SPEED = 10;
/** Below this speed the heading stays as it is. */
const MIN_TURN_SPEED = 0.1;

/** Horse state on the ground plane. Pure logic, no rendering. */
export class Horse {
  x = 0;
  z = 0;
  vx = 0;
  vz = 0;
  /**
   * Facing angle around the Y axis, in radians. 0 faces +X,
   * positive values turn towards -Z (same convention as Three.js rotation.y).
   */
  heading = 0;

  private dirX = 0;
  private dirZ = 0;

  get speed(): number {
    return Math.hypot(this.vx, this.vz);
  }

  /** Desired movement direction, normalized or (0, 0) for none. */
  setDirection(x: number, z: number): void {
    this.dirX = x;
    this.dirZ = z;
  }

  update(dt: number): void {
    this.updateVelocity(dt);
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.updateHeading(dt);
  }

  /** Moves the velocity towards the target velocity by a fixed rate. */
  private updateVelocity(dt: number): void {
    const moving = this.dirX !== 0 || this.dirZ !== 0;
    const targetX = this.dirX * MAX_SPEED;
    const targetZ = this.dirZ * MAX_SPEED;
    const dx = targetX - this.vx;
    const dz = targetZ - this.vz;
    const gap = Math.hypot(dx, dz);
    const step = (moving ? ACCELERATION : DECELERATION) * dt;
    if (gap <= step) {
      this.vx = targetX;
      this.vz = targetZ;
    } else {
      this.vx += (dx / gap) * step;
      this.vz += (dz / gap) * step;
    }
  }

  /** Turns the body towards the direction of travel, along the shorter way. */
  private updateHeading(dt: number): void {
    if (this.speed < MIN_TURN_SPEED) return;
    const target = Math.atan2(-this.vz, this.vx);
    const diff = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
    const maxStep = TURN_SPEED * dt;
    this.heading += Math.max(-maxStep, Math.min(maxStep, diff));
  }
}
