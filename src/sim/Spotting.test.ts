import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/random';
import { CellState, FireGrid } from './FireGrid';
import { Forest } from './Forest';
import { Horse } from './Horse';
import { Spotting } from './Spotting';
import { Wind } from './Wind';

const DT = 1 / 30;

/** A forest with a single test fire and a fixed east wind. */
function setup() {
  const forest = new Forest(mulberry32(3));
  const wind = new Wind(mulberry32(3));
  wind.angle = 0;
  const fire = new FireGrid(forest, mulberry32(5), wind);
  fire.burning.length = 0;
  fire.scheduled.length = 0;
  fire.state.fill(CellState.Fresh);
  const spotting = new Spotting(fire, forest, wind, mulberry32(7));
  return { forest, wind, fire, spotting };
}

describe('Spotting', () => {
  it('lets burning trees throw embers downwind', () => {
    const { forest, fire, spotting } = setup();
    const horse = new Horse(); // standing, so nothing lands ahead of it
    for (const t of forest.trees.slice(0, 60)) fire.ignite(fire.cellOf(t.x, t.z));
    const thrown: { dx: number; dz: number }[] = [];
    for (let t = 0; t < 10; t += DT) {
      fire.update(DT);
      spotting.update(DT, horse);
      for (const e of spotting.inFlight) if (e.age === 0) thrown.push({ dx: e.toX - e.fromX, dz: e.toZ - e.fromZ });
    }
    expect(thrown.length).toBeGreaterThan(0);
    for (const { dx, dz } of thrown) {
      expect(dx).toBeGreaterThan(0); // east, with the wind
      expect(Math.hypot(dx, dz)).toBeLessThanOrEqual(20 + 1e-9);
    }
  });

  it('drops embers ahead of a running horse near a fire, never right next to it', () => {
    const { fire, spotting } = setup();
    fire.ignite(fire.cellOf(-10, 0));
    const horse = new Horse();
    horse.speed = 6; // heading 0 = running towards +X
    const landings: number[] = [];
    for (let t = 0; t < 30; t += DT) {
      for (const e of spotting.inFlight) {
        if (e.age === 0 && e.fromX === fire.cellX(fire.cellOf(-10, 0))) landings.push(Math.hypot(e.toX, e.toZ));
      }
      spotting.update(DT, horse);
    }
    expect(landings.length).toBeGreaterThan(0);
    for (const d of landings) expect(d).toBeGreaterThanOrEqual(10);
  });

  it('starts a fire where an ember lands, after its flight', () => {
    const { fire, spotting } = setup();
    fire.ignite(fire.cellOf(-10, 0));
    const horse = new Horse();
    horse.speed = 6;
    let ember = spotting.inFlight[0];
    for (let t = 0; t < 20 && !ember; t += DT) {
      spotting.update(DT, horse);
      ember = spotting.inFlight[0];
    }
    expect(ember).toBeDefined();
    const target = fire.cellOf(ember.toX, ember.toZ);
    expect(fire.state[target]).toBe(CellState.Fresh);
    for (let t = 0; t <= ember.duration + DT; t += DT) spotting.update(DT, horse);
    expect(fire.state[target]).toBe(CellState.Burning);
  });
});
