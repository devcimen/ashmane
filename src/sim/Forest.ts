import type { Rng } from '../core/random';
import {
  CLEAR_RADIUS,
  COLLISION_FACTOR,
  EDGE_DENSITY,
  MAX_SCALE,
  MIN_SCALE,
  MIN_SPACING,
  THIN_OUT_DEPTH,
  TREE_DENSITY,
} from './balance';
import { ForestEdge } from './ForestEdge';

export type TreeType = 'pine' | 'broadleaf';

export interface Tree {
  x: number;
  z: number;
  scale: number;
  /** Rotation around the Y axis, in radians. */
  rotation: number;
  type: TreeType;
  /** Burnt down to a charred trunk; set by the fire simulation. */
  charred: boolean;
}

/** Crown radius per tree type at scale 1. */
export const CROWN_RADIUS: Record<TreeType, number> = { pine: 1.6, broadleaf: 1.9 };
/** Trunk radius at the base per tree type at scale 1; all that blocks once a tree is charred. */
const TRUNK_RADIUS: Record<TreeType, number> = { pine: 0.3, broadleaf: 0.38 };
/** Largest possible collision radius, used to widen neighbour searches. */
const MAX_COLLISION_RADIUS = Math.max(...Object.values(CROWN_RADIUS)) * MAX_SCALE * COLLISION_FACTOR;
/** Push-out passes; a second pass settles cases where two trees touch the same circle. */
const COLLISION_PASSES = 2;

export function collisionRadius(tree: Tree): number {
  if (tree.charred) return TRUNK_RADIUS[tree.type] * tree.scale;
  return CROWN_RADIUS[tree.type] * tree.scale * COLLISION_FACTOR;
}

export interface Collision {
  /** Position pushed out of all trees. */
  x: number;
  z: number;
  /** Combined push direction (unit length), pointing away from the trees. */
  nx: number;
  nz: number;
}

const ATTEMPTS_PER_TREE = 30;
/** Bucket size of the spatial lookup grid. */
const BUCKET_SIZE = 4;

/** Generates the forest for one run from a seeded RNG: its edge and its trees. */
export class Forest {
  readonly edge: ForestEdge;
  readonly trees: Tree[] = [];
  private readonly buckets = new Map<number, Tree[]>();

  constructor(rng: Rng) {
    this.edge = new ForestEdge(rng);
    this.plant(rng);
  }

  /** Trees whose centre lies within `radius` of (x, z). */
  treesNear(x: number, z: number, radius: number): Tree[] {
    const result: Tree[] = [];
    const r = Math.ceil(radius / BUCKET_SIZE);
    const bx = Math.floor(x / BUCKET_SIZE);
    const bz = Math.floor(z / BUCKET_SIZE);
    for (let i = bx - r; i <= bx + r; i++) {
      for (let j = bz - r; j <= bz + r; j++) {
        for (const t of this.buckets.get(bucketKey(i, j)) ?? []) {
          if ((t.x - x) ** 2 + (t.z - z) ** 2 <= radius * radius) result.push(t);
        }
      }
    }
    return result;
  }

  /** Pushes a circle out of any trees it overlaps. Returns null when nothing was hit. */
  collide(x: number, z: number, radius: number): Collision | null {
    let nx = 0;
    let nz = 0;
    let hit = false;
    for (let pass = 0; pass < COLLISION_PASSES; pass++) {
      for (const tree of this.treesNear(x, z, radius + MAX_COLLISION_RADIUS)) {
        const min = radius + collisionRadius(tree);
        const dx = x - tree.x;
        const dz = z - tree.z;
        const d = Math.hypot(dx, dz);
        if (d >= min) continue;
        // Exactly on the centre there is no direction; pick one.
        const ux = d > 1e-6 ? dx / d : 1;
        const uz = d > 1e-6 ? dz / d : 0;
        x = tree.x + ux * min;
        z = tree.z + uz * min;
        nx += ux;
        nz += uz;
        hit = true;
      }
    }
    if (!hit) return null;
    const len = Math.hypot(nx, nz) || 1;
    return { x, z, nx: nx / len, nz: nz / len };
  }

  /** Random dart throwing inside the edge, thinning out towards it, with a minimum spacing. */
  private plant(rng: Rng): void {
    const target = Math.round(this.edge.area() * TREE_DENSITY);
    const extent = Math.max(...Array.from({ length: 64 }, (_, i) => this.edge.radiusAt((i / 64) * Math.PI * 2)));
    for (let n = 0; n < target * ATTEMPTS_PER_TREE && this.trees.length < target; n++) {
      const x = (rng() * 2 - 1) * extent;
      const z = (rng() * 2 - 1) * extent;
      const inside = this.edge.distanceInside(x, z);
      if (inside <= 0 || Math.hypot(x, z) < CLEAR_RADIUS) continue;
      const density = EDGE_DENSITY + (1 - EDGE_DENSITY) * Math.min(1, inside / THIN_OUT_DEPTH);
      if (rng() > density) continue;
      if (this.treesNear(x, z, MIN_SPACING).length > 0) continue;
      this.add({
        x,
        z,
        scale: MIN_SCALE + rng() * (MAX_SCALE - MIN_SCALE),
        rotation: rng() * Math.PI * 2,
        type: rng() < 0.5 ? 'pine' : 'broadleaf',
        charred: false,
      });
    }
  }

  private add(tree: Tree): void {
    this.trees.push(tree);
    const key = bucketKey(Math.floor(tree.x / BUCKET_SIZE), Math.floor(tree.z / BUCKET_SIZE));
    const bucket = this.buckets.get(key);
    if (bucket) bucket.push(tree);
    else this.buckets.set(key, [tree]);
  }
}

function bucketKey(i: number, j: number): number {
  // Bucket indices stay well within ±1000 for any world size we use.
  return (i + 1000) * 4096 + (j + 1000);
}
