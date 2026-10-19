import * as THREE from 'three';
import type { FireGrid } from '../sim/FireGrid';
import { CROWN_RADIUS, type Forest, type TreeType } from '../sim/Forest';

interface TreePart {
  geometry: THREE.BufferGeometry;
  y: number;
  ox?: number;
  oz?: number;
  color: number;
  flat: boolean;
  /** Crown parts shrink away while the tree burns; the trunk stays as a charred stump. */
  crown: boolean;
}

// Trees are brighter than the ground so the dither renders them denser.
const LEAVES = 0xb4b4b4;
const PINE_TRUNK = 0x5a5a5a;
const BROADLEAF_TRUNK = 0x505050;

const TREE_PARTS: Record<TreeType, TreePart[]> = {
  pine: [
    { geometry: new THREE.CylinderGeometry(0.2, 0.3, 1.4, 6), y: 0.7, color: PINE_TRUNK, flat: true, crown: false },
    { geometry: new THREE.ConeGeometry(1.6, 1.9, 8), y: 2.0, color: LEAVES, flat: true, crown: true },
    { geometry: new THREE.ConeGeometry(1.3, 1.7, 8), y: 3.0, color: LEAVES, flat: true, crown: true },
    { geometry: new THREE.ConeGeometry(1.0, 1.5, 8), y: 3.9, color: LEAVES, flat: true, crown: true },
    { geometry: new THREE.ConeGeometry(0.65, 1.3, 8), y: 4.7, color: LEAVES, flat: true, crown: true },
  ],
  broadleaf: [
    { geometry: new THREE.CylinderGeometry(0.28, 0.38, 1.8, 6), y: 0.9, color: BROADLEAF_TRUNK, flat: true, crown: false },
    { geometry: new THREE.IcosahedronGeometry(1.55, 1), y: 3.2, color: LEAVES, flat: false, crown: true },
    { geometry: new THREE.IcosahedronGeometry(1.1, 1), y: 2.6, ox: 0.95, oz: 0.45, color: LEAVES, flat: false, crown: true },
    { geometry: new THREE.IcosahedronGeometry(1.15, 1), y: 2.7, ox: -0.9, oz: -0.4, color: LEAVES, flat: false, crown: true },
  ],
};

/** Shadows fall slightly away from the moon (which sits at -X, +Z). */
const SHADOW_OFFSET = { x: 0.5, z: -0.3 };
const SHADOW_OPACITY = 0.6;
/** Share of the shadow that remains under a charred trunk. */
const CHARRED_SHADOW = 0.25;
/** Share of the burn time at which the crown starts and finishes shrinking. */
const CROWN_SHRINK_START = 0.5;
const CROWN_SHRINK_END = 0.95;

/**
 * Draws all trees as instanced meshes, one mesh per tree part, plus a shadow blob under each crown.
 * Burning trees lose their crown; charred trunks stay.
 */
export class ForestView {
  readonly object = new THREE.Group();
  private readonly meshes: Record<TreeType, THREE.InstancedMesh[]> = { pine: [], broadleaf: [] };
  private readonly shadows: THREE.InstancedMesh;
  /** Instance index of each tree within the meshes of its type. */
  private readonly slot: Int32Array;
  /** Current crown size per tree, 1 = full, 0 = gone. */
  private readonly crown: Float32Array;
  private readonly dummy = new THREE.Object3D();

  constructor(private readonly forest: Forest) {
    const count: Record<TreeType, number> = { pine: 0, broadleaf: 0 };
    this.slot = Int32Array.from(forest.trees, (t) => count[t.type]++);
    this.crown = new Float32Array(forest.trees.length).fill(1);

    for (const type of Object.keys(TREE_PARTS) as TreeType[]) {
      for (const part of TREE_PARTS[type]) {
        const material = new THREE.MeshLambertMaterial({ color: part.color, flatShading: part.flat });
        const mesh = new THREE.InstancedMesh(part.geometry, material, Math.max(1, count[type]));
        mesh.count = count[type];
        this.meshes[type].push(mesh);
        this.object.add(mesh);
      }
    }
    this.shadows = createShadowMesh(forest.trees.length);
    this.object.add(this.shadows);

    forest.trees.forEach((_, i) => this.place(i, 1));
    this.markDirty();
    for (const mesh of this.object.children) (mesh as THREE.InstancedMesh).computeBoundingSphere();
  }

  /** Shrinks the crowns of burning trees and removes them once burnt out. */
  update(fire: FireGrid): void {
    let dirty = false;
    for (const c of fire.burning) {
      const t = fire.cellTree[c];
      if (t < 0) continue;
      const progress = fire.age[c] / fire.duration[c];
      dirty = this.setCrown(t, 1 - smoothstep(CROWN_SHRINK_START, CROWN_SHRINK_END, progress)) || dirty;
    }
    for (const c of fire.burntOut) {
      const t = fire.cellTree[c];
      if (t >= 0) dirty = this.setCrown(t, 0) || dirty;
    }
    if (dirty) this.markDirty();
  }

  /** Frees GPU resources. Tree part geometries are shared between forests and stay. */
  dispose(): void {
    for (const child of this.object.children) {
      if (!(child instanceof THREE.InstancedMesh)) continue;
      child.dispose();
      (child.material as THREE.Material).dispose();
    }
    this.shadows.geometry.dispose();
    this.object.removeFromParent();
  }

  /** Returns true if the tree's matrices changed. Tiny changes are skipped to save uploads. */
  private setCrown(t: number, size: number): boolean {
    if (size === this.crown[t] || (size > 0 && Math.abs(size - this.crown[t]) < 0.01)) return false;
    this.crown[t] = size;
    this.place(t, size);
    return true;
  }

  private place(t: number, crown: number): void {
    const tree = this.forest.trees[t];
    const slot = this.slot[t];
    const cos = Math.cos(tree.rotation);
    const sin = Math.sin(tree.rotation);
    const d = this.dummy;
    TREE_PARTS[tree.type].forEach((part, p) => {
      const scale = part.crown ? tree.scale * Math.max(crown, 0.0001) : tree.scale;
      const ox = (part.ox ?? 0) * tree.scale;
      const oz = (part.oz ?? 0) * tree.scale;
      d.position.set(tree.x + ox * cos + oz * sin, part.y * tree.scale, tree.z - ox * sin + oz * cos);
      d.rotation.set(0, tree.rotation, 0);
      d.scale.setScalar(scale);
      d.updateMatrix();
      this.meshes[tree.type][p].setMatrixAt(slot, d.matrix);
    });

    const r = CROWN_RADIUS[tree.type] * tree.scale * (CHARRED_SHADOW + (1 - CHARRED_SHADOW) * crown);
    d.position.set(tree.x + SHADOW_OFFSET.x * tree.scale, 0.02, tree.z + SHADOW_OFFSET.z * tree.scale);
    d.rotation.set(0, 0, 0);
    d.scale.set(r, 1, r);
    d.updateMatrix();
    this.shadows.setMatrixAt(t, d.matrix);
  }

  private markDirty(): void {
    for (const child of this.object.children) (child as THREE.InstancedMesh).instanceMatrix.needsUpdate = true;
  }
}

/** Dark blob under each crown that grounds the tree visually. */
function createShadowMesh(count: number): THREE.InstancedMesh {
  const geometry = new THREE.CircleGeometry(1, 16);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: SHADOW_OPACITY,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, count));
  mesh.count = count;
  return mesh;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
