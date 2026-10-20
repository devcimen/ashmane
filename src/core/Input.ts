/** Tracks pressed keys and exposes the movement direction (WASD / arrows). */
export class Input {
  private readonly pressed = new Set<string>();
  /** Keys pressed since they were last consumed (no auto-repeat). */
  private readonly presses = new Set<string>();

  private readonly onKeyDown = (e: KeyboardEvent) => {
    this.pressed.add(e.code);
    if (!e.repeat) this.presses.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent) => this.pressed.delete(e.code);
  private readonly onBlur = () => {
    this.pressed.clear();
    this.presses.clear();
  };

  constructor(private readonly target: Window = window) {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
  }

  /** Normalized direction on the ground plane; (0, 0) when idle. */
  direction(): { x: number; z: number } {
    const x = this.axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']);
    const z = this.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
    const len = Math.hypot(x, z);
    return len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 };
  }

  /** True once per key press of any of the given keys; clears those presses. */
  consumePress(...codes: string[]): boolean {
    let hit = false;
    for (const code of codes) hit = this.presses.delete(code) || hit;
    return hit;
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
  }

  private axis(positive: string[], negative: string[]): number {
    const pos = positive.some((k) => this.pressed.has(k)) ? 1 : 0;
    const neg = negative.some((k) => this.pressed.has(k)) ? 1 : 0;
    return pos - neg;
  }
}
