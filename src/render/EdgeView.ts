import * as THREE from 'three';
import { mulberry32 } from '../core/random';
import type { ForestEdge } from '../sim/ForestEdge';

/**
 * Pink like the horse: an approved exception to the palette, so the way out stands out
 * from everything else in the forest.
 */
const PINK = new THREE.Color(0xffa3d4);
/** Distance between glow motes along the edge. */
const SPACING = 1.6;
/** Motes float between these heights, bob up and down, and stray a little from the edge line. */
const HEIGHT_MIN = 0.3;
const HEIGHT_MAX = 1.8;
const BOB = 0.25;
const STRAY = 0.6;
const MOTE_SIZE = 0.14;
/** Twinkle: brightness swings between these shares. */
const TWINKLE_MIN = 0.35;
const TWINKLE_MAX = 1;

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
 * Marks the forest edge with small pink glowing motes, like fireflies along the border.
 * Through the fog they only show up when the horse gets close.
 */
export class EdgeView {
  readonly object: THREE.InstancedMesh;
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

    // Unlit, so the motes glow the same in the dark and next to fire.
    const geometry = new THREE.OctahedronGeometry(MOTE_SIZE, 0);
    this.object = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff }), this.motes.length);
    this.object.frustumCulled = false;
    this.update(0);
  }

  update(dt: number): void {
    this.time += dt;
    const { dummy: d, color, time: t } = this;
    this.motes.forEach((m, i) => {
      d.position.set(m.x, m.y + Math.sin(t * m.bob + m.phase) * BOB, m.z);
      d.updateMatrix();
      this.object.setMatrixAt(i, d.matrix);
      const glow = TWINKLE_MIN + (TWINKLE_MAX - TWINKLE_MIN) * (0.5 + 0.5 * Math.sin(t * m.twinkle + m.phase));
      this.object.setColorAt(i, color.copy(PINK).multiplyScalar(glow));
    });
    this.object.instanceMatrix.needsUpdate = true;
    if (this.object.instanceColor) this.object.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.object.geometry.dispose();
    (this.object.material as THREE.Material).dispose();
    this.object.dispose();
    this.object.removeFromParent();
  }
}
