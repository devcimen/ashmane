/**
 * HTML overlay above the canvas. For now only a centred message box;
 * the health bar comes with the fire step, the real menus with the menu step.
 */
export class Hud {
  private readonly message: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly detail: HTMLDivElement;

  constructor(container: HTMLElement) {
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

  showMessage(title: string, detail: string): void {
    this.title.textContent = title;
    this.detail.textContent = detail;
    this.message.style.display = 'block';
  }

  hideMessage(): void {
    this.message.style.display = 'none';
  }

  dispose(): void {
    this.message.remove();
  }
}
