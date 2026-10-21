/** Title: appears at once, stays this long, then is gone at once. */
const TITLE_TIME = 3;
/** Black pause between the title and the introduction. */
const PAUSE_TIME = 0.7;
/** The introduction fades in, and out again when the player starts. */
const INTRO_FADE = 0.9;
const CLOSE_FADE = 0.6;

const FONT = 'ui-monospace,Consolas,monospace';

type Phase = 'title' | 'pause' | 'intro' | 'closing' | 'done';

/**
 * Start screen on black: the title ASHMANE flashes up, then a short story with the controls.
 * Enter skips the title and starts the run from the introduction.
 */
export class Menu {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLDivElement;
  private readonly intro: HTMLDivElement;
  private phase: Phase = 'title';
  private time = 0;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:#000',
      'color:#fff',
      `font-family:${FONT}`,
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:16px',
    ].join(';');

    this.title = document.createElement('div');
    this.title.textContent = 'ASHMANE';
    this.title.style.cssText = 'font-size:clamp(40px,10vw,112px);letter-spacing:0.3em;margin-right:-0.3em';

    this.intro = document.createElement('div');
    this.intro.style.cssText = 'display:none;max-width:560px;font-size:15px;line-height:1.7;letter-spacing:0.02em';
    this.intro.innerHTML = `
      <p style="margin:0 0 1em">Almaas wakes.</p>
      <p style="margin:0 0 1em">A moment ago there was a dream. Now the air smells of smoke, and something
      glows red between the trees. The forest is burning.</p>
      <p style="margin:0 0 2em">Almaas has to get out before the fire catches him.</p>
      <table style="border-collapse:collapse;font-size:13px;opacity:0.85;margin-bottom:2.2em">
        ${row('WASD / Arrows', 'run')}
        ${row('Pink lights', 'the edge of the forest, the way out')}
        ${row('Wind', 'drives the fire, the arrow at the top left shows where')}
        ${row('Ash', 'do not stand still, it pulls you under')}
      </table>
      <p style="margin:0;letter-spacing:0.18em;font-size:13px">ENTER  ·  WAKE UP</p>`;

    this.root.append(this.title, this.intro);
    container.appendChild(this.root);
  }

  /** True once the menu has closed and the run should begin. */
  get done(): boolean {
    return this.phase === 'done';
  }

  /** `confirm` is true on the frame the player pressed Enter. */
  update(dt: number, confirm: boolean): void {
    this.time += dt;
    switch (this.phase) {
      case 'title':
        if (confirm || this.time >= TITLE_TIME) this.enter('pause');
        break;
      case 'pause':
        if (confirm || this.time >= PAUSE_TIME) this.enter('intro');
        break;
      case 'intro':
        if (confirm) this.enter('closing');
        break;
      case 'closing':
        if (this.time >= CLOSE_FADE) this.enter('done');
        break;
    }
  }

  dispose(): void {
    this.root.remove();
  }

  private enter(phase: Phase): void {
    this.phase = phase;
    this.time = 0;
    switch (phase) {
      case 'pause':
        this.title.style.display = 'none';
        break;
      case 'intro':
        this.intro.style.display = 'block';
        fade(this.intro, 0, 1, INTRO_FADE);
        break;
      case 'closing':
        fade(this.intro, 1, 0, CLOSE_FADE);
        break;
      case 'done':
        this.root.style.display = 'none';
        break;
    }
  }
}

function row(key: string, text: string): string {
  return `<tr><td style="padding:2px 24px 2px 0;white-space:nowrap;letter-spacing:0.1em">${key}</td><td style="padding:2px 0">${text}</td></tr>`;
}

function fade(el: HTMLElement, from: number, to: number, seconds: number): void {
  el.style.transition = 'none';
  el.style.opacity = String(from);
  void el.offsetWidth; // apply the start value before the transition begins
  el.style.transition = `opacity ${seconds}s ease`;
  el.style.opacity = String(to);
}
