import { Forest } from '../sim/Forest';
import { FireGrid } from '../sim/FireGrid';
import { Horse } from '../sim/Horse';
import { Renderer } from '../render/Renderer';
import { Input } from './Input';
import { mulberry32 } from './random';

const MAX_DT = 0.05;

/** Owns the main loop and wires simulation and rendering together. */
export class Game {
  readonly input = new Input();
  readonly horse = new Horse();
  readonly forest: Forest;
  readonly fire = new FireGrid();
  private readonly renderer: Renderer;
  private lastTime = 0;
  private frameId = 0;

  constructor(container: HTMLElement, readonly seed: number) {
    this.forest = new Forest(mulberry32(seed));
    this.renderer = new Renderer(container);
  }

  start(): void {
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.frameId);
  }

  update(dt: number): void {
    this.horse.update(dt);
    this.fire.update(dt);
  }

  private readonly frame = (now: number) => {
    this.frameId = requestAnimationFrame(this.frame);
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;
    this.update(dt);
    this.renderer.follow(this.horse.x, this.horse.z);
    this.renderer.render();
  };
}
