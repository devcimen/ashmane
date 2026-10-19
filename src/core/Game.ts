import { Forest } from '../sim/Forest';
import { FireGrid } from '../sim/FireGrid';
import { HORSE_RADIUS, Horse } from '../sim/Horse';
import { ForestView } from '../render/ForestView';
import { GroundView } from '../render/GroundView';
import { HorseView } from '../render/HorseView';
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
  private readonly horseView = new HorseView();
  private lastTime = 0;
  private frameId = 0;

  constructor(container: HTMLElement, readonly seed: number) {
    this.forest = new Forest(mulberry32(seed));
    this.renderer = new Renderer(container);
    this.renderer.scene.add(new GroundView().object, new ForestView(this.forest).object, this.horseView.object);
  }

  start(): void {
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.frameId);
  }

  update(dt: number): void {
    const dir = this.input.direction();
    this.horse.setDirection(dir.x, dir.z);
    this.horse.update(dt);
    const hit = this.forest.collide(this.horse.x, this.horse.z, HORSE_RADIUS);
    if (hit) {
      this.horse.x = hit.x;
      this.horse.z = hit.z;
      this.horse.bump(hit.nx, hit.nz);
    }
    this.fire.update(dt);
  }

  private readonly frame = (now: number) => {
    this.frameId = requestAnimationFrame(this.frame);
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;
    this.update(dt);
    this.horseView.update(this.horse, dt);
    this.renderer.follow(this.horse.x, this.horse.z, dt);
    this.renderer.render();
  };
}
