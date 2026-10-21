import { describe, expect, it } from 'vitest';
import { MAX_HEALTH, MAX_SPEED } from './balance';
import { Horse } from './Horse';

const DT = 1 / 60;

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

  it('stops when running head-on into an obstacle', () => {
    const horse = gallopingHorse(); // heading +X
    horse.bump(-1, 0);
    expect(horse.speed).toBe(0);
  });

  it('keeps most speed when grazing an obstacle', () => {
    const horse = gallopingHorse();
    const before = horse.speed;
    horse.bump(-Math.sin(0.2), Math.cos(0.2)); // surface almost parallel to the path
    expect(horse.speed).toBeGreaterThan(before * 0.9);
    expect(horse.speed).toBeLessThan(before);
  });

  it('ignores obstacles it is moving away from', () => {
    const horse = gallopingHorse();
    const before = horse.speed;
    horse.bump(1, 0);
    expect(horse.speed).toBe(before);
  });

  it('starts with full health and takes no damage without heat', () => {
    const horse = new Horse();
    horse.applyHeat(0, 1);
    expect(horse.health).toBe(MAX_HEALTH);
    expect(horse.alive).toBe(true);
  });

  it('loses more health the longer it stays in the heat', () => {
    const damageOver = (horse: Horse, seconds: number) => {
      const before = horse.health;
      for (let t = 0; t < seconds; t += 0.1) horse.applyHeat(1, 0.1);
      return before - horse.health;
    };
    const fresh = damageOver(new Horse(), 0.5);
    const exposed = new Horse();
    damageOver(exposed, 3);
    expect(fresh).toBeGreaterThan(0);
    expect(damageOver(exposed, 0.5)).toBeGreaterThan(fresh * 1.5);
  });

  it('recovers from exposure out of the heat, but not health', () => {
    const horse = new Horse();
    horse.applyHeat(1, 2);
    const health = horse.health;
    expect(horse.exposure).toBeGreaterThan(0);
    horse.applyHeat(0, 5);
    expect(horse.exposure).toBe(0);
    expect(horse.health).toBe(health);
  });

  it('reports the damage of the last heat update', () => {
    const horse = new Horse();
    horse.applyHeat(1, 0.1);
    expect(horse.lastDamage).toBeCloseTo(MAX_HEALTH - horse.health, 9);
    horse.applyHeat(0, 0.1);
    expect(horse.lastDamage).toBe(0);
  });

  it('dies at zero health and does not go below', () => {
    const horse = new Horse();
    for (let t = 0; t < 20; t += 0.1) horse.applyHeat(3, 0.1);
    expect(horse.health).toBe(0);
    expect(horse.alive).toBe(false);
  });

  it('sinks into ash and dies when standing on it for about six seconds', () => {
    const horse = new Horse();
    for (let t = 0; t < 5.5; t += DT) horse.applyGround(true, DT);
    expect(horse.sink).toBeGreaterThan(0.85);
    expect(horse.alive).toBe(true);
    for (let t = 0; t < 1; t += DT) horse.applyGround(true, DT);
    expect(horse.sunk).toBe(true);
    expect(horse.alive).toBe(false);
  });

  it('crosses ash at a gallop for much longer', () => {
    const horse = gallopingHorse();
    let seconds = 0;
    while (horse.alive && seconds < 60) {
      horse.update(DT);
      horse.applyGround(true, DT);
      seconds += DT;
    }
    expect(seconds).toBeGreaterThan(18);
    expect(seconds).toBeLessThan(32);
  });

  it('climbs back out of the ash on normal ground', () => {
    const horse = new Horse();
    for (let t = 0; t < 3; t += DT) horse.applyGround(true, DT);
    const deep = horse.sink;
    for (let t = 0; t < 1; t += DT) horse.applyGround(false, DT);
    expect(horse.sink).toBeLessThan(deep - 0.25);
    for (let t = 0; t < 3; t += DT) horse.applyGround(false, DT);
    expect(horse.sink).toBe(0);
  });

  it('is slowed down while sunk in', () => {
    const free = gallopingHorse();
    const stuck = gallopingHorse();
    stuck.sink = 0.8;
    run(free, 2);
    run(stuck, 2);
    expect(stuck.speed).toBeLessThan(free.speed * 0.7);
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
