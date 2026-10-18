import { Forest } from '../sim/Forest';
import { FireGrid } from '../sim/FireGrid';
import { Horse } from '../sim/Horse';
import { ForestView } from '../render/ForestView';
import { GroundView } from '../render/GroundView';
import { HorseView } from '../render/HorseView';
import { LOOKS, type Look } from '../render/look';
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
    const look = LOOKS[Number(new URLSearchParams(location.search).get('look') ?? 1) - 1] ?? LOOKS[0];
    const ground = new GroundView(look);
    const forestView = new ForestView(this.forest, look);
    this.renderer.scene.add(ground.object, forestView.object, this.horseView.object);
    installLookSwitcher(container, look, (l) => {
      ground.applyLook(l);
      forestView.applyLook(l);
    });
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

/** Temporary look comparison: keys 1–3 switch the variant, a label shows the active one. */
function installLookSwitcher(container: HTMLElement, initial: Look, apply: (look: Look) => void): void {
  const label = document.createElement('div');
  label.style.cssText =
    'position:fixed;left:12px;top:10px;font:12px monospace;color:#fff;background:#000;padding:4px 8px;pointer-events:none';
  label.textContent = `${initial.name}  (keys 1–3)`;
  container.appendChild(label);
  window.addEventListener('keydown', (e) => {
    const look = LOOKS[Number(e.key) - 1];
    if (!look) return;
    apply(look);
    label.textContent = `${look.name}  (keys 1–3)`;
  });
}
