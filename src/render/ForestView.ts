import * as THREE from 'three';
import type { Forest, Tree, TreeType } from '../sim/Forest';

interface TreePart {
  geometry: THREE.BufferGeometry;
  y: number;
  ox?: number;
  oz?: number;
  color: number;
  flat: boolean;
}

const TRUNK = 0x555555;
const LEAVES = 0x8a8a8a;

const TREE_PARTS: Record<TreeType, TreePart[]> = {
  pine: [
    { geometry: new THREE.CylinderGeometry(0.2, 0.3, 1.4, 6), y: 0.7, color: TRUNK, flat: true },
    { geometry: new THREE.ConeGeometry(1.6, 1.9, 8), y: 2.0, color: LEAVES, flat: true },
    { geometry: new THREE.ConeGeometry(1.3, 1.7, 8), y: 3.0, color: LEAVES, flat: true },
    { geometry: new THREE.ConeGeometry(1.0, 1.5, 8), y: 3.9, color: LEAVES, flat: true },
    { geometry: new THREE.ConeGeometry(0.65, 1.3, 8), y: 4.7, color: LEAVES, flat: true },
  ],
  broadleaf: [
    { geometry: new THREE.CylinderGeometry(0.28, 0.38, 1.8, 6), y: 0.9, color: 0x4d4d4d, flat: true },
    { geometry: new THREE.IcosahedronGeometry(1.55, 1), y: 3.2, color: LEAVES, flat: false },
    { geometry: new THREE.IcosahedronGeometry(1.1, 1), y: 2.6, ox: 0.95, oz: 0.45, color: LEAVES, flat: false },
    { geometry: new THREE.IcosahedronGeometry(1.15, 1), y: 2.7, ox: -0.9, oz: -0.4, color: LEAVES, flat: false },
  ],
};

/** Draws all trees as instanced meshes, one mesh per tree part. */
export class ForestView {
  readonly object = new THREE.Group();

  constructor(forest: Forest) {
    for (const type of Object.keys(TREE_PARTS) as TreeType[]) {
      const trees = forest.trees.filter((t) => t.type === type);
      for (const part of TREE_PARTS[type]) {
        this.object.add(createPartMesh(part, trees));
      }
    }
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
