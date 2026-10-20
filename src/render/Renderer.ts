import * as THREE from 'three';
import { DitherPass } from './DitherPass';

const CAMERA_OFFSET = new THREE.Vector3(0, 12, 12);
/** How quickly the camera catches up with the horse (1/s). Lower = more trailing. */
const CAMERA_RESPONSE = 5;
/** Largest camera shake offset in world units, at full shake. */
const SHAKE_MAX = 0.35;
/** How quickly the shake fades once it is no longer fed (1/s). */
const SHAKE_DECAY = 2.5;

// The dither shader classifies raw colour values, so we skip colour space
// conversion and treat hex colours as-is (like the r128 prototype).
THREE.ColorManagement.enabled = false;

/** Owns the WebGL renderer, the 3D scene and the fixed-angle camera. */
export class Renderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  readonly dither = new DitherPass(3);
  private readonly gl: THREE.WebGLRenderer;
  private readonly resizeObserver: ResizeObserver;
  /** Smoothed point the camera looks at; null until the first follow() call. */
  private focus: { x: number; z: number } | null = null;
  /** Current shake strength, 0 to 1. */
  private shakeAmount = 0;
  private shakeTime = 0;

  constructor(private readonly container: HTMLElement) {
    this.gl = new THREE.WebGLRenderer({ antialias: false });
    this.gl.setPixelRatio(1);
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    container.appendChild(this.gl.domElement);

    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.FogExp2(0x000000, 0.03);
    // Intensities are the prototype's r128 values times PI (modern lights dropped that factor).
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.32 * Math.PI));
    const moon = new THREE.DirectionalLight(0xffffff, 0.55 * Math.PI);
    moon.position.set(-12, 22, 8);
    this.scene.add(moon);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  /** Keeps the camera at a fixed angle above and behind the target, trailing it slightly. */
  follow(x: number, z: number, dt: number): void {
    if (this.focus) {
      const a = 1 - Math.exp(-CAMERA_RESPONSE * dt);
      this.focus.x += (x - this.focus.x) * a;
      this.focus.z += (z - this.focus.z) * a;
    } else {
      this.focus = { x, z };
    }

    // Shake: a jittery offset from a few mixed sines, squared so light shakes stay subtle.
    this.shakeTime += dt;
    this.shakeAmount = Math.max(0, this.shakeAmount - SHAKE_DECAY * dt);
    const s = this.shakeAmount ** 2 * SHAKE_MAX;
    const t = this.shakeTime;
    const sx = s * (Math.sin(t * 47) + 0.5 * Math.sin(t * 89 + 1.3));
    const sy = s * (Math.sin(t * 53 + 0.7) + 0.5 * Math.sin(t * 97 + 2.1));

    const fx = this.focus.x + sx;
    const fz = this.focus.z;
    this.camera.position.set(fx + CAMERA_OFFSET.x, CAMERA_OFFSET.y + sy, fz + CAMERA_OFFSET.z);
    this.camera.lookAt(fx, 1 + sy, fz);
  }

  /** Shakes the camera with at least this strength (0 to 1); it fades on its own. */
  shake(strength: number): void {
    this.shakeAmount = Math.max(this.shakeAmount, Math.min(1, strength));
  }

  /** Makes the next follow() jump straight to its target instead of gliding there. */
  resetCamera(): void {
    this.focus = null;
    this.shakeAmount = 0;
  }

  render(): void {
    this.dither.render(this.gl, this.scene, this.camera);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.dither.dispose();
    this.gl.dispose();
    this.gl.domElement.remove();
  }

  private resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dither.setSize(w, h);
  }
}
