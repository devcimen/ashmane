import * as THREE from 'three';

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Bayer 8x8 ordered dither. Each pixel is classified by hue:
// neutral -> black/white, pink -> horse, red -> fire.
const fragmentShader = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 res;
uniform float exposure;
varying vec2 vUv;

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float sat = (mx - mn) / max(mx, 0.0001);
  vec2 q = vUv - 0.5;
  float vig = clamp(1.0 - dot(q, q) * 1.3, 0.0, 1.0);
  float t = bayer8(floor(vUv * res));
  vec3 col = vec3(0.0);
  if (mx > 0.015) {
    if (sat < 0.12) {
      float v = dot(c, vec3(0.299, 0.587, 0.114)) * exposure * vig;
      col = v > t ? vec3(0.93) : vec3(0.02);
    } else if ((c.b - c.g) / mx > 0.08) {
      float v = mx * exposure * vig * 1.15;
      col = v > t ? vec3(1.0, 0.64, 0.83) : vec3(0.04, 0.01, 0.03);
    } else {
      float v = mx * vig;
      col = v > t ? vec3(0.58, 0.04, 0.05) : vec3(0.0);
    }
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Renders the scene into a low-resolution target, then draws it to the screen
 * through the Bayer dither shader. The pattern is fixed to screen pixels.
 */
export class DitherPass {
  private readonly target: THREE.WebGLRenderTarget;
  private readonly material: THREE.ShaderMaterial;
  private readonly quad: THREE.Mesh;
  private readonly postScene = new THREE.Scene();
  private readonly postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private width = 1;
  private height = 1;

  constructor(private pixelSize = 3) {
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
    });
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.target.texture },
        res: { value: new THREE.Vector2(1, 1) },
        exposure: { value: 1 },
      },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.postScene.add(this.quad);
  }

  get exposure(): number {
    return this.material.uniforms.exposure.value;
  }

  set exposure(value: number) {
    this.material.uniforms.exposure.value = value;
  }

  setPixelSize(size: number): void {
    this.pixelSize = Math.max(1, Math.round(size));
    this.setSize(this.width, this.height);
  }

  /** Output size in screen pixels; the target is that divided by the pixel size. */
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    const rw = Math.max(1, Math.ceil(width / this.pixelSize));
    const rh = Math.max(1, Math.ceil(height / this.pixelSize));
    this.target.setSize(rw, rh);
    this.material.uniforms.res.value.set(rw, rh);
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.postScene, this.postCamera);
  }

  dispose(): void {
    this.target.dispose();
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}
