import * as THREE from 'three';
import type { FireGrid } from '../sim/FireGrid';
import type { Forest, TreeType } from '../sim/Forest';
import { CELL_SIZE, GRID_SIZE } from '../sim/world';

/** Only fire within this distance of the camera focus is drawn. */
const VIEW_RADIUS = 45;
/** Burning cells within this distance are candidates for the moving fire lights. */
const LIGHT_RADIUS = 22;
const MAX_TREE_FLAMES = 300;
const MAX_GROUND_FLAMES = 1500;
const LIGHT_COUNT = 6;
/** Seconds between picking new spots for the fire lights. */
const LIGHT_RETARGET = 0.5;
/** How quickly the lights glide to their new spots (1/s). */
const LIGHT_RESPONSE = 2.5;
const EMBER_COUNT = 170;
const EMBER_MAX_HEIGHT = 6.5;

/** Flame size per tree type: base radius and height, from the look prototype. */
const TREE_FLAME: Record<TreeType, { radius: number; height: number }> = {
  pine: { radius: 2.0, height: 5.6 },
  broadleaf: { radius: 2.3, height: 5.0 },
};

interface FireLight {
  light: THREE.PointLight;
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  on: number;
  want: number;
}

interface Ember {
  x: number;
  z: number;
  y: number;
  speed: number;
  drift: number;
}

/**
 * Draws the fire: flame cones on burning trees and ground cells, glow discs, a few moving
 * point lights, rising embers, and a burn map that darkens burnt ground.
 */
export class FireView {
  readonly object = new THREE.Group();

  private readonly treeFlames: THREE.InstancedMesh[];
  private readonly treeFlameMaterials: THREE.MeshBasicMaterial[];
  private readonly groundFlames: THREE.InstancedMesh;
  private readonly groundFlameMaterial = flameMaterial();
  private readonly glow: THREE.InstancedMesh;
  private readonly glowMaterial = flameMaterial();
  private readonly lights: FireLight[] = [];
  private lightTimer = 0;
  private readonly embers: Ember[] = [];
  private readonly emberPositions = new Float32Array(EMBER_COUNT * 3);
  private readonly emberGeometry = new THREE.BufferGeometry();
  private readonly burnCanvas = document.createElement('canvas');
  private readonly burnContext: CanvasRenderingContext2D;
  private readonly burnTexture: THREE.CanvasTexture;
  private readonly dummy = new THREE.Object3D();
  private time = 0;

  constructor(
    private readonly fire: FireGrid,
    private readonly forest: Forest,
  ) {
    const flameGeometry = new THREE.ConeGeometry(1, 1, 7);
    flameGeometry.translate(0, 0.5, 0);
    this.treeFlameMaterials = [flameMaterial(), flameMaterial(), flameMaterial()];
    this.treeFlames = this.treeFlameMaterials.map((m) => this.instanced(flameGeometry, m, MAX_TREE_FLAMES));

    const groundFlameGeometry = new THREE.ConeGeometry(0.62, 1, 5);
    groundFlameGeometry.translate(0, 0.5, 0);
    this.groundFlames = this.instanced(groundFlameGeometry, this.groundFlameMaterial, MAX_GROUND_FLAMES);

    const glowGeometry = new THREE.CircleGeometry(0.95, 10);
    glowGeometry.rotateX(-Math.PI / 2);
    this.glow = this.instanced(glowGeometry, this.glowMaterial, MAX_GROUND_FLAMES);

    for (let i = 0; i < LIGHT_COUNT; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 18, 1.5);
      this.object.add(light);
      this.lights.push({ light, x: 0, y: 1, z: 0, tx: 0, ty: 1, tz: 0, on: 0, want: 0 });
    }

    for (let i = 0; i < EMBER_COUNT; i++) {
      this.embers.push({ x: 0, z: 0, y: 99, speed: 1.2 + Math.random() * 2, drift: (Math.random() - 0.5) * 0.8 });
    }
    this.emberGeometry.setAttribute('position', new THREE.BufferAttribute(this.emberPositions, 3));
    const embers = new THREE.Points(
      this.emberGeometry,
      new THREE.PointsMaterial({ color: new THREE.Color(1, 0.12, 0.12), size: 2, sizeAttenuation: false }),
    );
    embers.frustumCulled = false;
    this.object.add(embers);

    this.burnCanvas.width = this.burnCanvas.height = GRID_SIZE;
    this.burnContext = this.burnCanvas.getContext('2d')!;
    this.burnTexture = new THREE.CanvasTexture(this.burnCanvas);
    this.burnTexture.minFilter = this.burnTexture.magFilter = THREE.NearestFilter;
    this.burnTexture.generateMipmaps = false;
    const burnPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE),
      new THREE.MeshBasicMaterial({ map: this.burnTexture, transparent: true, depthWrite: false }),
    );
    burnPlane.rotation.x = -Math.PI / 2;
    burnPlane.position.y = 0.01;
    this.object.add(burnPlane);
  }

  update(dt: number, focusX: number, focusZ: number): void {
    this.time += dt;
    const t = this.time;
    const flicker = (speed: number, phase: number) => 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * speed + phase));
    setFireColor(this.treeFlameMaterials[0], flicker(9, 0));
    setFireColor(this.treeFlameMaterials[1], flicker(7.3, 1.3));
    setFireColor(this.treeFlameMaterials[2], flicker(11, 2.1));
    setFireColor(this.groundFlameMaterial, 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 8.2 + 0.7)));
    setFireColor(this.glowMaterial, 0.3 + 0.12 * Math.sin(t * 5));

    const near = this.updateFlames(focusX, focusZ);
    this.updateLights(dt, near);
    this.updateEmbers(dt, near);
    this.updateBurnMap();
  }

  dispose(): void {
    this.object.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
      if (o instanceof THREE.InstancedMesh) o.dispose();
    });
    this.burnTexture.dispose();
    this.object.removeFromParent();
  }

  /** Places flame instances for burning cells near the focus; returns the cells close enough for lights. */
  private updateFlames(focusX: number, focusZ: number): number[] {
    const { fire, dummy: d, time: t } = this;
    const near: number[] = [];
    let trees = 0;
    let ground = 0;
    for (const c of fire.burning) {
      const x = fire.cellX(c);
      const z = fire.cellZ(c);
      const dist2 = (x - focusX) ** 2 + (z - focusZ) ** 2;
      if (dist2 > VIEW_RADIUS * VIEW_RADIUS) continue;
      if (dist2 < LIGHT_RADIUS * LIGHT_RADIUS) near.push(c);
      const k = fire.intensity(c);
      const treeIndex = fire.cellTree[c];

      if (treeIndex >= 0 && trees < MAX_TREE_FLAMES) {
        const tree = this.forest.trees[treeIndex];
        const size = TREE_FLAME[tree.type];
        const fl = 0.8 + 0.25 * Math.sin(t * 9 + tree.rotation * 3) + 0.1 * Math.sin(t * 17 + tree.x);
        const h = (0.35 + 0.65 * k) * fl;
        const w = size.radius * tree.scale * (0.85 + 0.15 * fl);
        const s = tree.scale;
        d.rotation.set(0, t * 1.2 + tree.rotation, 0);
        d.position.set(tree.x, 0, tree.z);
        d.scale.set(w, size.height * s * h, w);
        this.setAt(this.treeFlames[0], trees);
        d.position.set(tree.x + 0.7 * s, 0, tree.z + 0.4 * s);
        d.scale.set(s, size.height * 0.7 * s * h * (0.8 + 0.4 * Math.sin(t * 11 + tree.x)), s);
        this.setAt(this.treeFlames[1], trees);
        d.position.set(tree.x - 0.6 * s, 0, tree.z - 0.5 * s);
        d.scale.set(0.9 * s, size.height * 0.8 * s * h * (0.8 + 0.4 * Math.sin(t * 13 + tree.z)), 0.9 * s);
        this.setAt(this.treeFlames[2], trees);
        trees++;
      } else if (treeIndex < 0 && ground < MAX_GROUND_FLAMES) {
        const fl = 0.7 + 0.3 * Math.sin(t * 8 + c) + 0.15 * Math.sin(t * 15 + c * 0.7);
        d.rotation.set(0, c, 0);
        d.position.set(x, 0, z);
        d.scale.set(1, (0.5 + 1.1 * k) * fl, 1);
        this.setAt(this.groundFlames, ground);
        const g = (0.95 + 0.2 * fl) * (0.5 + 0.5 * k);
        d.position.set(x, 0.03, z);
        d.scale.set(g, 1, g);
        this.setAt(this.glow, ground);
        ground++;
      }
    }
    for (const m of this.treeFlames) finish(m, trees);
    finish(this.groundFlames, ground);
    finish(this.glow, ground);
    return near;
  }

  /** A few point lights glide between burning spots near the focus and flicker. */
  private updateLights(dt: number, near: number[]): void {
    const { fire } = this;
    this.lightTimer -= dt;
    if (this.lightTimer <= 0) {
      this.lightTimer = LIGHT_RETARGET;
      for (const L of this.lights) {
        if (near.length === 0) {
          L.want = 0;
          continue;
        }
        const c = near[Math.floor(Math.random() * near.length)];
        L.tx = fire.cellX(c);
        L.tz = fire.cellZ(c);
        L.ty = fire.cellTree[c] >= 0 ? 2.4 : 1.0;
        L.want = 1;
      }
    }
    const a = 1 - Math.exp(-dt * LIGHT_RESPONSE);
    this.lights.forEach((L, i) => {
      L.x += (L.tx - L.x) * a;
      L.y += (L.ty - L.y) * a;
      L.z += (L.tz - L.z) * a;
      L.on += (L.want - L.on) * a;
      L.light.position.set(L.x, L.y, L.z);
      // Prototype intensity times PI (modern lights dropped that factor).
      L.light.intensity = L.on * (1.1 + 0.5 * (0.5 + 0.5 * Math.sin(this.time * 9 + i * 2))) * Math.PI;
    });
  }

  /** Embers rise from random burning cells near the focus and drift a little. */
  private updateEmbers(dt: number, near: number[]): void {
    const { fire } = this;
    this.embers.forEach((e, i) => {
      e.y += e.speed * dt;
      if (e.y > EMBER_MAX_HEIGHT) {
        if (near.length > 0) {
          const c = near[Math.floor(Math.random() * near.length)];
          e.x = fire.cellX(c) + (Math.random() - 0.5) * 1.4;
          e.z = fire.cellZ(c) + (Math.random() - 0.5) * 1.4;
          e.y = 0.3;
        } else {
          e.y = 99;
        }
      }
      this.emberPositions[i * 3] = e.x + Math.sin(this.time * 2 + i) * e.drift * 0.5 * (e.y / 6);
      this.emberPositions[i * 3 + 1] = e.y < 90 ? e.y : -50;
      this.emberPositions[i * 3 + 2] = e.z;
    });
    this.emberGeometry.attributes.position.needsUpdate = true;
  }

  /** Darkens cells that burnt out since the last frame. */
  private updateBurnMap(): void {
    const { fire } = this;
    if (fire.burntOut.length === 0) return;
    for (const c of fire.burntOut) {
      // Slightly varying darkness per cell so the scorched ground is not a flat patch.
      const shade = 0.62 + (0.3 * (((c * 2654435761) >>> 0) % 100)) / 100;
      this.burnContext.fillStyle = `rgba(0,0,0,${shade.toFixed(2)})`;
      this.burnContext.fillRect(c % GRID_SIZE, Math.floor(c / GRID_SIZE), 1, 1);
    }
    this.burnTexture.needsUpdate = true;
  }

  private instanced(geometry: THREE.BufferGeometry, material: THREE.Material, max: number): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, max);
    mesh.frustumCulled = false;
    mesh.count = 0;
    this.object.add(mesh);
    return mesh;
  }

  private setAt(mesh: THREE.InstancedMesh, index: number): void {
    this.dummy.updateMatrix();
    mesh.setMatrixAt(index, this.dummy.matrix);
  }
}

function flameMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: 0xff1f1f });
}

/** Dark red scaled by brightness; the dither pass classifies it as fire. */
function setFireColor(material: THREE.MeshBasicMaterial, k: number): void {
  material.color.setRGB(k, k * 0.12, k * 0.12);
}

function finish(mesh: THREE.InstancedMesh, count: number): void {
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
}
