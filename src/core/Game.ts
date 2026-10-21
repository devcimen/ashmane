import { type Collision, Forest } from '../sim/Forest';
import { FireGrid } from '../sim/FireGrid';
import { HORSE_RADIUS, MAX_HEALTH } from '../sim/balance';
import { Horse } from '../sim/Horse';
import { FIRE_SEED_SALT, SPOT_SEED_SALT, WIND_SEED_SALT } from '../sim/seeds';
import { Spotting } from '../sim/Spotting';
import { Wind } from '../sim/Wind';
import { EdgeView } from '../render/EdgeView';
import { FireView } from '../render/FireView';
import { ForestView } from '../render/ForestView';
import { GroundView } from '../render/GroundView';
import { HorseView } from '../render/HorseView';
import { Hud } from '../render/Hud';
import { Menu } from '../render/Menu';
import { Renderer } from '../render/Renderer';
import { Input } from './Input';
import { mulberry32, randomSeed } from './random';

const MAX_DT = 0.05;
/** Damage per second that shakes the camera at full strength; less damage shakes less. */
const SHAKE_FULL_DAMAGE = 60;
/** Waking up at the start of a run: total seconds, and how long the screen takes to fade in. */
const WAKE_DURATION = 3.4;
const WAKE_FADE = 2;

type GameState = 'menu' | 'waking' | 'playing' | 'won' | 'dead';

/** Owns the main loop and the run state, and wires simulation and rendering together. */
export class Game {
  readonly input = new Input();
  private readonly renderer: Renderer;
  private readonly hud: Hud;
  private readonly horseView = new HorseView();
  private readonly menu: Menu;

  // Everything below is replaced on every new run.
  private seed = 0;
  private horse = new Horse();
  private forest!: Forest;
  private wind!: Wind;
  private fire!: FireGrid;
  private spotting!: Spotting;
  private forestView?: ForestView;
  private fireView?: FireView;
  private edgeView?: EdgeView;
  private state: GameState = 'menu';
  private elapsed = 0;
  private wakeTime = 0;

  private lastTime = 0;
  private frameId = 0;

  constructor(container: HTMLElement, seed: number) {
    this.renderer = new Renderer(container);
    this.hud = new Hud(container);
    this.renderer.scene.add(new GroundView().object, this.horseView.object);
    // The first forest is built behind the menu; the run begins once the menu closes.
    this.buildRun(seed);
    this.menu = new Menu(container);
  }

  start(): void {
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.frameId);
  }

  update(dt: number): void {
    if (this.state === 'menu') {
      this.menu.update(dt, this.input.consumePress('Enter', 'Space'));
      if (this.menu.done) this.beginRun();
      return;
    }

    const restart = this.input.consumePress('Enter', 'KeyR');
    if ((this.state === 'won' || this.state === 'dead') && restart) {
      this.buildRun(randomSeed());
      this.beginRun();
      return;
    }

    if (this.state === 'waking') this.wake(dt);

    if (this.state === 'playing') {
      const dir = this.input.direction();
      this.horse.setDirection(dir.x, dir.z);
      this.elapsed += dt;
    } else {
      this.horse.setDirection(0, 0);
    }

    this.horse.update(dt);
    this.resolve(this.forest.collide(this.horse.x, this.horse.z, HORSE_RADIUS));
    this.wind.update(dt);
    this.fire.update(dt);
    this.spotting.update(dt, this.horse);
    this.horse.applyHeat(this.fire.heatAt(this.horse.x, this.horse.z), dt);
    this.horse.applyGround(this.fire.isBurntAt(this.horse.x, this.horse.z), dt);

    this.hud.setHealth(this.horse.health / MAX_HEALTH);
    this.hud.setWind(this.wind.angle, this.wind.strength);

    if (this.state !== 'playing') return;
    if (!this.horse.alive) this.end('dead', this.horse.sunk ? 'Swallowed' : 'Burnt');
    else if (!this.forest.edge.contains(this.horse.x, this.horse.z)) this.end('won', 'Escaped');
  }

  /** The horse lies in the forest as if waking from a dream, gets up, and only then can run. */
  private wake(dt: number): void {
    this.wakeTime += dt;
    const progress = Math.min(1, this.wakeTime / WAKE_DURATION);
    this.horseView.setWake(progress);
    if (progress >= 1) this.state = 'playing';
  }

  private end(state: GameState, title: string): void {
    this.state = state;
    if (state === 'dead') this.horseView.die(this.horse.sunk ? 'sunk' : 'burnt');
    const detail = `${this.elapsed.toFixed(1)} s  ·  Forest ${this.seed}  ·  Enter for a new forest`;
    this.hud.showEnd(title, detail, state === 'dead');
  }

  /** Moves the horse out of an obstacle and lets it lose speed accordingly. */
  private resolve(hit: Collision | null): void {
    if (!hit) return;
    this.horse.x = hit.x;
    this.horse.z = hit.z;
    this.horse.bump(hit.nx, hit.nz);
  }

  /** Builds a fresh forest from the seed and puts the horse back in the middle, lying down. */
  private buildRun(seed: number): void {
    this.seed = seed;
    console.info(`Ashmane seed: ${seed}`);
    this.forest = new Forest(mulberry32(seed));
    this.horse = new Horse();
    // Separate random stream, so the forest layout does not depend on how the fire rolls.
    this.wind = new Wind(mulberry32(seed ^ WIND_SEED_SALT));
    this.fire = new FireGrid(this.forest, mulberry32(seed ^ FIRE_SEED_SALT), this.wind);
    this.spotting = new Spotting(this.fire, this.forest, this.wind, mulberry32(seed ^ SPOT_SEED_SALT));
    this.elapsed = 0;

    this.forestView?.dispose();
    this.fireView?.dispose();
    this.edgeView?.dispose();
    this.forestView = new ForestView(this.forest);
    this.fireView = new FireView(this.fire, this.forest, this.wind, this.spotting);
    this.edgeView = new EdgeView(this.forest.edge);
    this.renderer.scene.add(this.forestView.object, this.fireView.object, this.edgeView.object);
    this.horseView.reset();
    this.horseView.setWake(0);
    this.renderer.resetCamera();
  }

  /** Starts the run: fade in from black while the horse wakes up. */
  private beginRun(): void {
    this.state = 'waking';
    this.wakeTime = 0;
    this.hud.hideEnd();
    this.hud.fadeIn(WAKE_FADE);
  }

  private readonly frame = (now: number) => {
    this.frameId = requestAnimationFrame(this.frame);
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;
    this.update(dt);
    this.forestView?.update(this.fire);
    this.fireView?.update(dt, this.horse.x, this.horse.z);
    this.edgeView?.update(dt);
    this.horseView.update(this.horse, dt);
    if (dt > 0 && this.state === 'playing') this.renderer.shake(this.horse.lastDamage / dt / SHAKE_FULL_DAMAGE);
    this.renderer.follow(this.horse.x, this.horse.z, dt);
    this.renderer.render();
  };
}
