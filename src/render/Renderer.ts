import * as THREE from 'three';

const CAMERA_OFFSET = new THREE.Vector3(0, 12, 12);

/** Owns the WebGL renderer, the 3D scene and the fixed-angle camera. */
export class Renderer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  private readonly gl: THREE.WebGLRenderer;
  private readonly resizeObserver: ResizeObserver;

  constructor(private readonly container: HTMLElement) {
    this.gl = new THREE.WebGLRenderer({ antialias: false });
    this.gl.setPixelRatio(1);
    container.appendChild(this.gl.domElement);

    this.scene.background = new THREE.Color(0x000000);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  /** Keeps the camera at a fixed angle above and behind the target. */
  follow(x: number, z: number): void {
    this.camera.position.set(x + CAMERA_OFFSET.x, CAMERA_OFFSET.y, z + CAMERA_OFFSET.z);
    this.camera.lookAt(x, 1, z);
  }

  render(): void {
    this.gl.render(this.scene, this.camera);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.gl.dispose();
    this.gl.domElement.remove();
  }

  private resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
