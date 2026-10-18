import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/random';
import { Forest } from './Forest';

describe('Forest', () => {
  it('generates the same layout for the same seed', () => {
    const a = new Forest(mulberry32(123));
    const b = new Forest(mulberry32(123));
    expect(a.trees).toEqual(b.trees);
  });

  it('keeps the start area free', () => {
    const forest = new Forest(mulberry32(5));
    for (const t of forest.trees) expect(Math.hypot(t.x, t.z)).toBeGreaterThanOrEqual(5);
  });
});
