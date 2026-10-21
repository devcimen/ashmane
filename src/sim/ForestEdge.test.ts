import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/random';
import { ForestEdge } from './ForestEdge';
import { FOREST_RADIUS_MAX, FOREST_RADIUS_MIN } from './balance';

const angles = Array.from({ length: 720 }, (_, i) => (i / 720) * Math.PI * 2);

describe('ForestEdge', () => {
  it('stays within the configured radius range', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const edge = new ForestEdge(mulberry32(seed));
      for (const a of angles) {
        const r = edge.radiusAt(a);
        expect(r).toBeGreaterThanOrEqual(FOREST_RADIUS_MIN);
        expect(r).toBeLessThanOrEqual(FOREST_RADIUS_MAX);
      }
    }
  });

  it('is not equally far in every direction', () => {
    const edge = new ForestEdge(mulberry32(42));
    const radii = angles.map((a) => edge.radiusAt(a));
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(20);
  });

  it('is the same for the same seed and differs between seeds', () => {
    const a = new ForestEdge(mulberry32(7));
    const b = new ForestEdge(mulberry32(7));
    const c = new ForestEdge(mulberry32(8));
    expect(a.radiusAt(1.234)).toBe(b.radiusAt(1.234));
    expect(a.radiusAt(1.234)).not.toBe(c.radiusAt(1.234));
  });

  it('traces its outline with evenly spaced points on the edge', () => {
    const edge = new ForestEdge(mulberry32(9));
    const points = edge.outline(2);
    expect(points.length).toBeGreaterThan(200);
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      expect(Math.abs(edge.distanceInside(p.x, p.z))).toBeLessThan(1e-6);
      const q = points[(i + 1) % points.length];
      expect(Math.hypot(q.x - p.x, q.z - p.z)).toBeLessThan(2.2);
    }
  });

  it('contains the centre but not points beyond the maximum radius', () => {
    const edge = new ForestEdge(mulberry32(5));
    expect(edge.contains(0, 0)).toBe(true);
    expect(edge.contains(FOREST_RADIUS_MAX + 1, 0)).toBe(false);
    expect(edge.contains(0, -(FOREST_RADIUS_MAX + 1))).toBe(false);
  });
});
