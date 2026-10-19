import { Forest } from '../sim/Forest';
import { FireGrid } from '../sim/FireGrid';
import { HORSE_RADIUS, Horse } from '../sim/Horse';
import { ForestView } from '../render/ForestView';
import { GroundView } from '../render/GroundView';
import { HorseView } from '../render/HorseView';
import { Hud } from '../render/Hud';
import { Renderer } from '../render/Renderer';
import { Input } from './Input';
import { mulberry32, randomSeed } from './random';

const MAX_DT = 0.05;

type GameState = 'playing' | 'won';

/** Owns the main loop and the run state, and wires simulation and rendering together. */
export class Game {
  readonly input = new Input();
  private readonly renderer: Renderer;
  private readonly hud: Hud;
  private readonly horseView = new HorseView();

  // Everything below is replaced on every new run.
  private seed = 0;
  private horse = new Horse();
  private forest!: Forest;
  private fire = new FireGrid();
  private forestView: ForestView | null = null;
  private state: GameState = 'playing';
  private elapsed = 0;

  private lastTime = 0;
  private frameId = 0;

  constructor(container: HTMLElement, seed: number) {
    this.renderer = new Renderer(container);
    this.hud = new Hud(container);
    this.renderer.scene.add(new GroundView().object, this.horseView.object);
    this.newRun(seed);
  }

  start(): void {
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.frameId);
  }

  update(dt: number): void {
    const restart = this.input.consumePress('Enter', 'KeyR');
    if (this.state === 'won' && restart) {
      this.newRun(randomSeed());
      return;
    }

    if (this.state === 'playing') {
      const dir = this.input.direction();
      this.horse.setDirection(dir.x, dir.z);
      this.elapsed += dt;
    } else {
      this.horse.setDirection(0, 0);
    }

    this.horse.update(dt);
    const hit = this.forest.collide(this.horse.x, this.horse.z, HORSE_RADIUS);
    if (hit) {
      this.horse.x = hit.x;
      this.horse.z = hit.z;
      this.horse.bump(hit.nx, hit.nz);
    }
    this.fire.update(dt);

    if (this.state === 'playing' && !this.forest.edge.contains(this.horse.x, this.horse.z)) {
      this.state = 'won';
      this.hud.showMessage(
        'Entkommen',
        `${this.elapsed.toFixed(1)} s  ·  Wald ${this.seed}  ·  Enter für einen neuen Wald`,
      );
    }
  }

  /** Builds a fresh forest from the seed and puts the horse back in the middle. */
  private newRun(seed: number): void {
    this.seed = seed;
    console.info(`Ashmane seed: ${seed}`);
    this.forest = new Forest(mulberry32(seed));
    this.horse = new Horse();
    this.fire = new FireGrid();
    this.state = 'playing';
    this.elapsed = 0;

    this.forestView?.dispose();
    this.forestView = new ForestView(this.forest);
    this.renderer.scene.add(this.forestView.object);
    this.horseView.reset();
    this.renderer.resetCamera();
    this.hud.hideMessage();
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
