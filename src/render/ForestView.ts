import * as THREE from 'three';
import type { Forest, Tree, TreeType } from '../sim/Forest';
import type { Look } from './look';

type PartRole = 'trunk' | 'leaves';

interface TreePart {
  geometry: THREE.BufferGeometry;
  y: number;
  ox?: number;
  oz?: number;
  role: PartRole;
  flat: boolean;
}

const TREE_PARTS: Record<TreeType, TreePart[]> = {
  pine: [
    { geometry: new THREE.CylinderGeometry(0.2, 0.3, 1.4, 6), y: 0.7, role: 'trunk', flat: true },
    { geometry: new THREE.ConeGeometry(1.6, 1.9, 8), y: 2.0, role: 'leaves', flat: true },
    { geometry: new THREE.ConeGeometry(1.3, 1.7, 8), y: 3.0, role: 'leaves', flat: true },
    { geometry: new THREE.ConeGeometry(1.0, 1.5, 8), y: 3.9, role: 'leaves', flat: true },
    { geometry: new THREE.ConeGeometry(0.65, 1.3, 8), y: 4.7, role: 'leaves', flat: true },
  ],
  broadleaf: [
    { geometry: new THREE.CylinderGeometry(0.28, 0.38, 1.8, 6), y: 0.9, role: 'trunk', flat: true },
    { geometry: new THREE.IcosahedronGeometry(1.55, 1), y: 3.2, role: 'leaves', flat: false },
    { geometry: new THREE.IcosahedronGeometry(1.1, 1), y: 2.6, ox: 0.95, oz: 0.45, role: 'leaves', flat: false },
    { geometry: new THREE.IcosahedronGeometry(1.15, 1), y: 2.7, ox: -0.9, oz: -0.4, role: 'leaves', flat: false },
  ],
};

/** Crown radius per tree type, used for the shadow blob. */
const CROWN_RADIUS: Record<TreeType, number> = { pine: 1.6, broadleaf: 1.9 };
/** Shadows fall slightly away from the moon (which sits at -X, +Z). */
const SHADOW_OFFSET = { x: 0.5, z: -0.3 };

/** Draws all trees as instanced meshes, one mesh per tree part, plus optional shadow blobs. */
export class ForestView {
  readonly object = new THREE.Group();
  private readonly parts: { role: PartRole; type: TreeType; material: THREE.MeshLambertMaterial }[] = [];
  private readonly shadows: THREE.InstancedMesh;

  constructor(forest: Forest, look: Look) {
    for (const type of Object.keys(TREE_PARTS) as TreeType[]) {
      const trees = forest.trees.filter((t) => t.type === type);
      for (const part of TREE_PARTS[type]) {
        const material = new THREE.MeshLambertMaterial({ flatShading: part.flat });
        this.parts.push({ role: part.role, type, material });
        this.object.add(createPartMesh(part, material, trees));
      }
    }
    this.shadows = createShadowMesh(forest.trees);
    this.object.add(this.shadows);
    this.applyLook(look);
  }

  applyLook(look: Look): void {
    for (const { role, type, material } of this.parts) {
      const trunk = type === 'pine' ? look.pineTrunk : look.broadleafTrunk;
      material.color.setHex(role === 'trunk' ? trunk : look.leaves);
    }
    this.shadows.visible = look.shadows;
  }
}

function createPartMesh(part: TreePart, material: THREE.Material, trees: Tree[]): THREE.InstancedMesh {
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

function createShadowMesh(trees: Tree[]): THREE.InstancedMesh {
  const geometry = new THREE.CircleGeometry(1, 16);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false });
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
