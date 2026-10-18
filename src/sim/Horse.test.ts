import { describe, expect, it } from 'vitest';
import { Horse } from './Horse';

const DT = 1 / 60;
const MAX_SPEED = 7;

function run(horse: Horse, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) horse.update(DT);
}

function gallopingHorse(): Horse {
  const horse = new Horse();
  horse.setDirection(1, 0);
  run(horse, 3);
  return horse;
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

  it('reaches but does not exceed full speed', () => {
    const horse = gallopingHorse();
    expect(horse.speed).toBeCloseTo(MAX_SPEED, 2);
    expect(horse.speed).toBeLessThanOrEqual(MAX_SPEED);
  });

  it('coasts to a full stop after input is released', () => {
    const horse = gallopingHorse();
    horse.setDirection(0, 0);
    horse.update(DT);
    expect(horse.speed).toBeGreaterThan(0);
    run(horse, 3);
    expect(horse.speed).toBe(0);
  });

  it('always moves along its heading', () => {
    const horse = new Horse();
    horse.setDirection(Math.SQRT1_2, -Math.SQRT1_2);
    run(horse, 0.4);
    horse.setDirection(0, 1);
    run(horse, 0.2);
    const moveAngle = Math.atan2(-horse.vz, horse.vx);
    expect(moveAngle).toBeCloseTo(horse.heading, 6);
  });

  it('turns to face the desired direction', () => {
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

  it('slows down for a U-turn', () => {
    const horse = gallopingHorse();
    horse.setDirection(-1, 0);
    run(horse, 0.4);
    expect(horse.speed).toBeLessThan(MAX_SPEED * 0.6);
  });

  it('turns tighter when slow than at full gallop', () => {
    const slow = new Horse();
    slow.speed = 1;
    const fast = new Horse();
    fast.speed = MAX_SPEED;
    for (const horse of [slow, fast]) {
      horse.setDirection(0, -1);
      horse.update(DT);
    }
    expect(slow.heading).toBeGreaterThan(fast.heading * 1.5);
  });
});
