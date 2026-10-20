import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/random';
import { Forest, collisionRadius } from './Forest';

const forest = new Forest(mulberry32(5));

describe('Forest', () => {
  it('generates the same layout for the same seed', () => {
    const a = new Forest(mulberry32(123));
    const b = new Forest(mulberry32(123));
    expect(a.trees).toEqual(b.trees);
  });

  it('plants a big forest', () => {
    expect(forest.trees.length).toBeGreaterThan(300);
  });

  it('keeps the start area free', () => {
    for (const t of forest.trees) expect(Math.hypot(t.x, t.z)).toBeGreaterThanOrEqual(5);
  });

  it('plants only inside the edge', () => {
    for (const t of forest.trees) expect(forest.edge.contains(t.x, t.z)).toBe(true);
  });

  it('keeps a minimum distance between trees', () => {
    for (const t of forest.trees.slice(0, 100)) {
      const close = forest.treesNear(t.x, t.z, 2.99).filter((o) => o !== t);
      expect(close).toEqual([]);
    }
  });

  it('pushes a circle out of a tree it overlaps', () => {
    const tree = forest.trees[0];
    const hit = forest.collide(tree.x + 0.1, tree.z, 0.45);
    expect(hit).not.toBeNull();
    const distance = Math.hypot(hit!.x - tree.x, hit!.z - tree.z);
    expect(distance).toBeGreaterThanOrEqual(0.45 + collisionRadius(tree) - 1e-9);
    expect(hit!.nx).toBeCloseTo(1, 6);
  });

  it('reports no collision in the clear start area', () => {
    expect(forest.collide(0, 0, 0.45)).toBeNull();
  });

  it('thins out towards the edge', () => {
    // Trees per area in a band at a given depth inside the edge.
    const density = (from: number, to: number) => {
      const count = forest.trees.filter((t) => {
        const d = forest.edge.distanceInside(t.x, t.z);
        return d >= from && d < to;
      }).length;
      let area = 0;
      const steps = 360;
      for (let i = 0; i < steps; i++) {
        const r = forest.edge.radiusAt((i / steps) * Math.PI * 2);
        area += 0.5 * ((r - from) ** 2 - (r - to) ** 2) * ((Math.PI * 2) / steps);
      }
      return count / area;
    };
    expect(density(0, 8)).toBeLessThan(density(40, 48) * 0.7);
  });
});
