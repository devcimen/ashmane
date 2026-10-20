/** Same pink as the horse: the bar is the horse's life. */
const HEALTH_COLOR = '#ffa3d4';

/**
 * HTML overlay above the canvas: a health bar and a centred message box.
 * The real menus come with the menu step.
 */
export class Hud {
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
      'display:none',
    ].join(';');
    this.title = document.createElement('div');
    this.title.style.cssText = 'font-size:28px;letter-spacing:0.12em;text-transform:uppercase';
    this.detail = document.createElement('div');
    this.detail.style.cssText = 'margin-top:10px;font-size:13px;letter-spacing:0.06em;opacity:0.8';
    this.message.append(this.title, this.detail);
    container.appendChild(this.message);
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

  showMessage(title: string, detail: string): void {
    this.title.textContent = title;
    this.detail.textContent = detail;
    this.message.style.display = 'block';
  }

  hideMessage(): void {
    this.message.style.display = 'none';
  }

  dispose(): void {
    this.healthBar.remove();
    this.windBox.remove();
    this.message.remove();
  }
}
