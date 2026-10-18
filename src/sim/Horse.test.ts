import { describe, expect, it } from 'vitest';
import { Horse } from './Horse';

const DT = 1 / 60;

function run(horse: Horse, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) horse.update(DT);
}

describe('Horse', () => {
  it('stands still without input', () => {
    const horse = new Horse();
    run(horse, 1);
    expect(horse.x).toBe(0);
    expect(horse.z).toBe(0);
  });

  it('accelerates gradually instead of jumping to full speed', () => {
    const horse = new Horse();
    horse.setDirection(1, 0);
    horse.update(DT);
    const early = horse.speed;
    run(horse, 2);
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(horse.speed);
  });

  it('caps the speed', () => {
    const horse = new Horse();
    horse.setDirection(0, -1);
    run(horse, 3);
    expect(horse.speed).toBeCloseTo(7, 5);
    expect(horse.z).toBeLessThan(0);
  });

  it('slows down to a stop after input is released', () => {
    const horse = new Horse();
    horse.setDirection(1, 0);
    run(horse, 2);
    horse.setDirection(0, 0);
    horse.update(DT);
    expect(horse.speed).toBeGreaterThan(0);
    run(horse, 2);
    expect(horse.speed).toBe(0);
  });

  it('turns to face the direction of travel', () => {
    const horse = new Horse();
    horse.setDirection(0, -1); // up on screen = -Z
    run(horse, 1);
    expect(horse.heading).toBeCloseTo(Math.PI / 2, 3);
  });

  it('turns the short way around', () => {
    const horse = new Horse();
    horse.heading = Math.PI * 0.9;
    horse.setDirection(-Math.cos(0.1 * Math.PI), Math.sin(0.1 * Math.PI)); // just past PI
    horse.update(DT);
    expect(horse.heading).toBeGreaterThan(Math.PI * 0.9);
  });
});
