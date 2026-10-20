/** Same pink as the horse: the bar is the horse's life. */
const HEALTH_COLOR = '#ffa3d4';

/**
 * HTML overlay above the canvas: a health bar and a centred message box.
 * The real menus come with the menu step.
 */
export class Hud {
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
    this.message.remove();
  }
}
