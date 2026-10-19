import * as THREE from 'three';
import { CROWN_RADIUS, type Forest, type Tree, type TreeType } from '../sim/Forest';

interface TreePart {
  geometry: THREE.BufferGeometry;
  y: number;
  ox?: number;
  oz?: number;
  color: number;
  flat: boolean;
}

// Trees are brighter than the ground so the dither renders them denser.
const LEAVES = 0xb4b4b4;
const PINE_TRUNK = 0x5a5a5a;
const BROADLEAF_TRUNK = 0x505050;

const TREE_PARTS: Record<TreeType, TreePart[]> = {
  pine: [
    { geometry: new THREE.CylinderGeometry(0.2, 0.3, 1.4, 6), y: 0.7, color: PINE_TRUNK, flat: true },
    { geometry: new THREE.ConeGeometry(1.6, 1.9, 8), y: 2.0, color: LEAVES, flat: true },
    { geometry: new THREE.ConeGeometry(1.3, 1.7, 8), y: 3.0, color: LEAVES, flat: true },
    { geometry: new THREE.ConeGeometry(1.0, 1.5, 8), y: 3.9, color: LEAVES, flat: true },
    { geometry: new THREE.ConeGeometry(0.65, 1.3, 8), y: 4.7, color: LEAVES, flat: true },
  ],
  broadleaf: [
    { geometry: new THREE.CylinderGeometry(0.28, 0.38, 1.8, 6), y: 0.9, color: BROADLEAF_TRUNK, flat: true },
    { geometry: new THREE.IcosahedronGeometry(1.55, 1), y: 3.2, color: LEAVES, flat: false },
    { geometry: new THREE.IcosahedronGeometry(1.1, 1), y: 2.6, ox: 0.95, oz: 0.45, color: LEAVES, flat: false },
    { geometry: new THREE.IcosahedronGeometry(1.15, 1), y: 2.7, ox: -0.9, oz: -0.4, color: LEAVES, flat: false },
  ],
};

/** Shadows fall slightly away from the moon (which sits at -X, +Z). */
const SHADOW_OFFSET = { x: 0.5, z: -0.3 };
const SHADOW_OPACITY = 0.6;

/** Draws all trees as instanced meshes, one mesh per tree part, plus a shadow blob under each crown. */
export class ForestView {
  readonly object = new THREE.Group();
  private readonly shadows: THREE.InstancedMesh;

  constructor(forest: Forest) {
    for (const type of Object.keys(TREE_PARTS) as TreeType[]) {
      const trees = forest.trees.filter((t) => t.type === type);
      for (const part of TREE_PARTS[type]) {
        this.object.add(createPartMesh(part, trees));
      }
    }
    this.shadows = createShadowMesh(forest.trees);
    this.object.add(this.shadows);
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
}

function createPartMesh(part: TreePart, trees: Tree[]): THREE.InstancedMesh {
  const material = new THREE.MeshLambertMaterial({ color: part.color, flatShading: part.flat });
  const mesh = new THREE.InstancedMesh(part.geometry, material, Math.max(1, trees.length));
  mesh.count = trees.length;
  const dummy = new THREE.Object3D();
  trees.forEach((tree, i) => {
    const cos = Math.cos(tree.rotation);
    const sin = Math.sin(tree.rotation);
    const ox = (part.ox ?? 0) * tree.scale;
    const oz = (part.oz ?? 0) * tree.scale;
    dummy.position.set(tree.x + ox * cos + oz * sin, part.y * tree.scale, tree.z - ox * sin + oz * cos);
    dummy.rotation.set(0, tree.rotation, 0);
    dummy.scale.setScalar(tree.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/** Dark blob under each crown that grounds the tree visually. */
function createShadowMesh(trees: Tree[]): THREE.InstancedMesh {
  const geometry = new THREE.CircleGeometry(1, 16);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: SHADOW_OPACITY,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, trees.length));
  mesh.count = trees.length;
  const dummy = new THREE.Object3D();
  trees.forEach((tree, i) => {
    const r = CROWN_RADIUS[tree.type] * tree.scale;
    dummy.position.set(tree.x + SHADOW_OFFSET.x * tree.scale, 0.02, tree.z + SHADOW_OFFSET.z * tree.scale);
    dummy.scale.set(r, 1, r);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}
