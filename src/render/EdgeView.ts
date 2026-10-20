import * as THREE from 'three';
import { mulberry32 } from '../core/random';
import type { ForestEdge } from '../sim/ForestEdge';

/**
 * Pink like the horse: an approved exception to the palette, so the way out stands out
 * from everything else in the forest.
 */
const PINK = new THREE.Color(0xffa3d4);
/** Distance between glow motes along the edge. */
const SPACING = 1.1;
/** Motes float between these heights, bob up and down, and stray a little from the edge line. */
const HEIGHT_MIN = 0.3;
const HEIGHT_MAX = 1.8;
const BOB = 0.25;
const STRAY = 0.5;
const MOTE_SIZE = 0.28;
/** Twinkle: brightness swings between these shares. */
const TWINKLE_MIN = 0.5;
const TWINKLE_MAX = 1;
/** Dashed line on the ground along the edge: dash spacing, size and brightness. */
const DASH_SPACING = 0.9;
const DASH_LENGTH = 0.5;
const DASH_WIDTH = 0.14;
const DASH_GLOW = 0.75;

interface Mote {
  x: number;
  z: number;
  y: number;
  /** Bob and twinkle speeds and phase, so the motes do not pulse in lockstep. */
  bob: number;
  twinkle: number;
  phase: number;
}

/**
 * Marks the forest edge with a dashed pink line on the ground and pink glowing motes
 * floating above it, like fireflies along the border. Through the fog they only show up
 * when the horse gets close.
 */
export class EdgeView {
  readonly object = new THREE.Group();
  private readonly moteMesh: THREE.InstancedMesh;
  private readonly dashes: THREE.InstancedMesh;
  private readonly motes: Mote[];
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private time = 0;

  constructor(edge: ForestEdge) {
    const rng = mulberry32(11);
    this.motes = edge.outline(SPACING).map(({ x, z }) => {
      const len = Math.hypot(x, z) || 1;
      const stray = (rng() * 2 - 1) * STRAY;
      return {
        x: x + (x / len) * stray,
        z: z + (z / len) * stray,
        y: HEIGHT_MIN + rng() * (HEIGHT_MAX - HEIGHT_MIN),
        bob: 0.8 + rng() * 1.2,
        twinkle: 1.5 + rng() * 3,
        phase: rng() * Math.PI * 2,
      };
    });

    // Unlit, so the marker glows the same in the dark and next to fire.
    const geometry = new THREE.OctahedronGeometry(MOTE_SIZE, 0);
    this.moteMesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff }), this.motes.length);
    this.moteMesh.frustumCulled = false;
    this.dashes = createDashes(edge);
    this.object.add(this.dashes, this.moteMesh);
    this.update(0);
  }

  update(dt: number): void {
    this.time += dt;
    const { dummy: d, color, time: t } = this;
    this.motes.forEach((m, i) => {
      d.position.set(m.x, m.y + Math.sin(t * m.bob + m.phase) * BOB, m.z);
      d.updateMatrix();
      this.moteMesh.setMatrixAt(i, d.matrix);
      const glow = TWINKLE_MIN + (TWINKLE_MAX - TWINKLE_MIN) * (0.5 + 0.5 * Math.sin(t * m.twinkle + m.phase));
      this.moteMesh.setColorAt(i, color.copy(PINK).multiplyScalar(glow));
    });
    this.moteMesh.instanceMatrix.needsUpdate = true;
    if (this.moteMesh.instanceColor) this.moteMesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    for (const mesh of [this.moteMesh, this.dashes]) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
    this.object.removeFromParent();
  }
}

/** Short flat dashes lying on the ground along the edge, each turned along the line. */
function createDashes(edge: ForestEdge): THREE.InstancedMesh {
  const points = edge.outline(DASH_SPACING);
  const geometry = new THREE.PlaneGeometry(DASH_LENGTH, DASH_WIDTH);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: PINK.clone().multiplyScalar(DASH_GLOW) });
  const mesh = new THREE.InstancedMesh(geometry, material, points.length);
  mesh.frustumCulled = false;
  const d = new THREE.Object3D();
  points.forEach((p, i) => {
    const next = points[(i + 1) % points.length];
    d.position.set(p.x, 0.04, p.z);
    // PlaneGeometry runs along X; turn it to follow the edge towards the next point.
    d.rotation.set(0, -Math.atan2(next.z - p.z, next.x - p.x), 0);
    d.updateMatrix();
    mesh.setMatrixAt(i, d.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}
