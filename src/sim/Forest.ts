import type { Rng } from '../core/random';
import { ForestEdge } from './ForestEdge';

export type TreeType = 'pine' | 'broadleaf';

export interface Tree {
  x: number;
  z: number;
  scale: number;
  /** Rotation around the Y axis, in radians. */
  rotation: number;
  type: TreeType;
}

/** Crown radius per tree type at scale 1. */
export const CROWN_RADIUS: Record<TreeType, number> = { pine: 1.6, broadleaf: 1.9 };

/** Trees per square unit deep inside the forest. */
const TREE_DENSITY = 0.016;
/** Minimum distance between two tree centres. */
const MIN_SPACING = 3;
/** Radius around the start (origin) that stays free of trees. */
const CLEAR_RADIUS = 5;
/** Over this distance before the edge the forest thins out. */
const THIN_OUT_DEPTH = 25;
/** Share of trees that remain right at the edge. */
const EDGE_DENSITY = 0.3;
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
        scale: 0.85 + rng() * 0.6,
        rotation: rng() * Math.PI * 2,
        type: rng() < 0.5 ? 'pine' : 'broadleaf',
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
