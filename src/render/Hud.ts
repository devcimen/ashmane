/** Same pink as the horse: the bar is the horse's life. */
const HEALTH_COLOR = '#ffa3d4';
/** Game over: the world fades to dim (and grey on death) this slowly, then the message appears. */
const VEIL_FADE = 1.6;
const MESSAGE_DELAY = 0.9;
const MESSAGE_FADE = 0.6;
const VEIL_DIM = 0.55;

/**
 * HTML overlay above the canvas: health bar, wind arrow, an end-of-run veil with a message,
 * and a black curtain for fading in at the start. The real menus come with the menu step.
 */
export class Hud {
  private readonly veil: HTMLDivElement;
  private readonly curtain: HTMLDivElement;
  private readonly windBox: HTMLDivElement;
  private readonly windArrow: HTMLDivElement;
  private readonly healthBar: HTMLDivElement;
  private readonly healthFill: HTMLDivElement;
  private readonly message: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly detail: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.healthBar = document.createElement('div');
    this.healthBar.style.cssText =
      'position:fixed;left:16px;top:16px;width:200px;height:12px;border:1px solid #fff;background:#000;pointer-events:none';
    this.healthFill = document.createElement('div');
    this.healthFill.style.cssText = `height:100%;width:100%;background:${HEALTH_COLOR}`;
    this.healthBar.appendChild(this.healthFill);
    container.appendChild(this.healthBar);

    // Wind: an arrow that points where the wind blows, as seen from the fixed camera.
    this.windBox = document.createElement('div');
    this.windBox.style.cssText = [
      'position:fixed',
      'left:16px',
      'top:38px',
      'display:flex',
      'align-items:center',
      'gap:8px',
      'color:#fff',
      'font:11px ui-monospace,Consolas,monospace',
      'letter-spacing:0.12em',
      'pointer-events:none',
    ].join(';');
    const label = document.createElement('span');
    label.textContent = 'WIND';
    this.windArrow = document.createElement('div');
    this.windArrow.textContent = '→';
    this.windArrow.style.cssText = 'font-size:18px;line-height:1;transform-origin:50% 50%';
    this.windBox.append(label, this.windArrow);
    container.appendChild(this.windBox);

    // Veil over the world at the end of a run; the message box sits on top of it.
    this.veil = document.createElement('div');
    this.veil.style.cssText = 'position:fixed;inset:0;pointer-events:none;opacity:0';
    container.appendChild(this.veil);

    this.message = document.createElement('div');
    this.message.style.cssText = [
      'position:fixed',
      'left:50%',
      'top:50%',
      'transform:translate(-50%,-50%)',
      'padding:20px 32px',
      'background:#000',
      'border:1px solid #fff',
      'color:#fff',
      'font-family:ui-monospace,Consolas,monospace',
      'text-align:center',
      'pointer-events:none',
      'opacity:0',
    ].join(';');
    this.title = document.createElement('div');
    this.title.style.cssText = 'font-size:28px;letter-spacing:0.12em;text-transform:uppercase';
    this.detail = document.createElement('div');
    this.detail.style.cssText = 'margin-top:10px;font-size:13px;letter-spacing:0.06em;opacity:0.8';
    this.message.append(this.title, this.detail);
    container.appendChild(this.message);

    // Black curtain above everything, for fading in from darkness.
    this.curtain = document.createElement('div');
    this.curtain.style.cssText = 'position:fixed;inset:0;background:#000;pointer-events:none;opacity:0';
    container.appendChild(this.curtain);
  }

  /** Starts fully black and fades to the world over the given seconds. */
  fadeIn(seconds: number): void {
    fade(this.curtain, 1, 0, seconds, 0);
  }

  /** Health as a share of the maximum, 0 to 1. */
  setHealth(fraction: number): void {
    this.healthFill.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
  }

  /**
   * Wind direction (radians, atan2(z, x) in world space) and strength. The camera looks
   * along -Z, so world +X is screen right and world +Z is screen down; CSS rotation
   * is clockwise on screen, which matches the angle directly.
   */
  setWind(angle: number, strength: number): void {
    this.windArrow.style.transform = `rotate(${angle}rad) scale(${0.7 + 0.3 * strength})`;
  }

  /**
   * End of a run: the world slowly dims, turning grey as well when `grey` is set, so it is
   * clear the world is no longer playable. The message fades in a moment later.
   */
  showEnd(title: string, detail: string, grey: boolean): void {
    this.title.textContent = title;
    this.detail.textContent = detail;
    const filter = grey ? 'grayscale(1)' : 'none';
    this.veil.style.backdropFilter = filter;
    this.veil.style.background = `rgba(0,0,0,${VEIL_DIM})`;
    fade(this.veil, 0, 1, VEIL_FADE, 0);
    fade(this.message, 0, 1, MESSAGE_FADE, MESSAGE_DELAY);
  }

  hideEnd(): void {
    fade(this.veil, 0, 0, 0, 0);
    fade(this.message, 0, 0, 0, 0);
  }

  dispose(): void {
    this.healthBar.remove();
    this.windBox.remove();
    this.veil.remove();
    this.message.remove();
    this.curtain.remove();
  }
}

/** Jumps an element to `from` opacity, then transitions to `to`. */
function fade(el: HTMLElement, from: number, to: number, seconds: number, delay: number): void {
  el.style.transition = 'none';
  el.style.opacity = String(from);
  void el.offsetWidth; // apply the start value before the transition begins
  el.style.transition = `opacity ${seconds}s ease ${delay}s`;
  el.style.opacity = String(to);
}
