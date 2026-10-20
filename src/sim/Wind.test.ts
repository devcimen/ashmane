import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/random';
import { Wind } from './Wind';

function run(wind: Wind, seconds: number, dt = 1 / 30): void {
  for (let t = 0; t < seconds; t += dt) wind.update(dt);
}

describe('Wind', () => {
  it('blows along a unit direction', () => {
    const wind = new Wind(mulberry32(1));
    run(wind, 10);
    expect(Math.hypot(wind.dirX, wind.dirZ)).toBeCloseTo(1, 9);
  });

  it('is the same for the same seed', () => {
    const a = new Wind(mulberry32(4));
    const b = new Wind(mulberry32(4));
    run(a, 60);
    run(b, 60);
    expect(a.angle).toBe(b.angle);
  });

  it('swings around over time, but only slowly', () => {
    const wind = new Wind(mulberry32(2));
    const start = wind.angle;
    let previous = wind.angle;
    let maxStep = 0;
    for (let t = 0; t < 120; t += 0.1) {
      wind.update(0.1);
      maxStep = Math.max(maxStep, Math.abs(wind.angle - previous));
      previous = wind.angle;
    }
    expect(Math.abs(wind.angle - start)).toBeGreaterThan(0.2);
    expect(maxStep).toBeLessThanOrEqual(0.012 + 1e-9);
  });

  it('gusts around its base strength and stays calm when created calm', () => {
    const wind = new Wind(mulberry32(3));
    const calm = new Wind(mulberry32(3), 0);
    for (let t = 0; t < 30; t += 0.1) {
      wind.update(0.1);
      calm.update(0.1);
      expect(wind.strength).toBeGreaterThan(0.6);
      expect(wind.strength).toBeLessThan(1.4);
      expect(calm.strength).toBe(0);
    }
  });
});
