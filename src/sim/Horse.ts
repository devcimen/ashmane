/** Horse state on the ground plane. Pure logic, no rendering. */
export class Horse {
  x = 0;
  z = 0;
  /** Facing angle around the Y axis, in radians. */
  heading = 0;

  update(_dt: number): void {
    // Movement and health come with the gameplay step.
  }
}
