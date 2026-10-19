import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/random';
import { CellState, FireGrid, HEAT_RADIUS } from './FireGrid';
import { Forest } from './Forest';

const DT = 1 / 30;

function setup(seed = 3) {
  const forest = new Forest(mulberry32(seed));
  const fire = new FireGrid(forest, mulberry32(seed + 1000));
  return { forest, fire };
}

function run(fire: FireGrid, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) fire.update(DT);
}

function count(fire: FireGrid, state: CellState): number {
  return fire.state.reduce((n, s) => (s === state ? n + 1 : n), 0);
}

describe('FireGrid', () => {
  it('starts with three 3×3 fire origins away from the start', () => {
    const { fire } = setup();
    expect(fire.burning.length).toBe(27);
    for (const c of fire.burning) {
      const d = Math.hypot(fire.cellX(c), fire.cellZ(c));
      expect(d).toBeGreaterThan(12);
      expect(d).toBeLessThan(33);
    }
  });

  it('spreads and leaves burnt cells behind', () => {
    const { fire } = setup();
    run(fire, 20);
    expect(count(fire, CellState.Burning)).toBeGreaterThan(27);
    expect(count(fire, CellState.Burnt)).toBeGreaterThan(0);
  });

  it('is reproducible for the same seed', () => {
    const a = setup(9).fire;
    const b = setup(9).fire;
    run(a, 10);
    run(b, 10);
    expect(Array.from(a.state)).toEqual(Array.from(b.state));
  });

  it('burns trees longer than ground', () => {
    const { forest, fire } = setup();
    const treeCell = fire.cellOf(forest.trees[0].x, forest.trees[0].z);
    const groundCell = fire.cellOf(0, 0);
    fire.ignite(treeCell);
    fire.ignite(groundCell);
    expect(fire.duration[treeCell]).toBeGreaterThan(fire.duration[groundCell]);
  });

  it('chars a tree once its cell burns out', () => {
    const { forest, fire } = setup();
    const tree = forest.trees[0];
    fire.ignite(fire.cellOf(tree.x, tree.z));
    expect(tree.charred).toBe(false);
    run(fire, 20);
    expect(tree.charred).toBe(true);
  });

  it('radiates heat near flames and none far away', () => {
    const { fire } = setup();
    run(fire, 2); // let the origins flare up
    const c = fire.burning[0];
    expect(fire.heatAt(fire.cellX(c), fire.cellZ(c))).toBeGreaterThan(0.5);
    expect(fire.heatAt(0, 0)).toBe(0);
    expect(HEAT_RADIUS).toBeGreaterThan(0);
  });

  it('pushes a circle out of a strongly burning cell', () => {
    const { fire } = setup();
    const c = fire.cellOf(0, 0);
    fire.ignite(c);
    run(fire, 1.5);
    const hit = fire.collide(fire.cellX(c) + 1.0, fire.cellZ(c), 0.45);
    expect(hit).not.toBeNull();
    expect(hit!.x - fire.cellX(c)).toBeGreaterThanOrEqual(0.8 + 0.45 - 1e-6);
  });

  it('does not block before a fire has flared up', () => {
    const { fire } = setup();
    const c = fire.cellOf(0, 0);
    fire.ignite(c);
    expect(fire.collide(fire.cellX(c), fire.cellZ(c), 0.45)).toBeNull();
  });
});
