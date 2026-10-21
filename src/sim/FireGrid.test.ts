import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/random';
import {
  HEAT_RADIUS,
  INNER_DISTANCE_MAX,
  INNER_DISTANCE_MIN,
  INNER_ORIGIN_COUNT,
  INNER_PATCH_RADIUS,
  OUTER_DELAY_MAX,
  OUTER_DELAY_MIN,
  OUTER_DEPTH_MAX,
  OUTER_DEPTH_MIN,
  OUTER_ORIGIN_COUNT_MAX,
  OUTER_ORIGIN_COUNT_MIN,
} from './balance';
import { CellState, FireGrid } from './FireGrid';
import { Forest } from './Forest';
import { Wind } from './Wind';
import { CELL_SIZE } from './world';

const DT = 1 / 30;

function setup(seed = 3) {
  const forest = new Forest(mulberry32(seed));
  // Calm wind, so these tests check the fire itself.
  const fire = new FireGrid(forest, mulberry32(seed + 1000), new Wind(mulberry32(seed), 0));
  return { forest, fire };
}

function run(fire: FireGrid, seconds: number): void {
  for (let t = 0; t < seconds; t += DT) fire.update(DT);
}

function count(fire: FireGrid, state: CellState): number {
  return fire.state.reduce((n, s) => (s === state ? n + 1 : n), 0);
}

describe('FireGrid', () => {
  it('starts with inner fire patches around, but not at, the start', () => {
    const { fire } = setup();
    // A patch reaches this far around its centre (radius in cells plus the cell's own size).
    const reach = (INNER_PATCH_RADIUS + 1) * CELL_SIZE;
    expect(fire.burning.length).toBeGreaterThanOrEqual(INNER_ORIGIN_COUNT);
    for (const c of fire.burning) {
      const d = Math.hypot(fire.cellX(c), fire.cellZ(c));
      expect(d).toBeGreaterThan(INNER_DISTANCE_MIN - reach);
      expect(d).toBeLessThan(INNER_DISTANCE_MAX + reach);
    }
  });

  it('spreads the inner fires around the start instead of clustering them', () => {
    for (const seed of [1, 4, 7]) {
      const { fire } = setup(seed);
      const angles = fire.burning.map((c) => Math.atan2(fire.cellZ(c), fire.cellX(c)));
      // No half of the circle may be free of fire.
      for (let a = -Math.PI; a < Math.PI; a += 0.1) {
        const inHalf = angles.some((b) => Math.cos(b - a) > 0);
        expect(inHalf).toBe(true);
      }
    }
  });

  it('schedules outer fires towards the edge that flare up later', () => {
    const { forest, fire } = setup();
    expect(fire.scheduled.length).toBeGreaterThanOrEqual(OUTER_ORIGIN_COUNT_MIN);
    expect(fire.scheduled.length).toBeLessThanOrEqual(OUTER_ORIGIN_COUNT_MAX);
    for (const s of fire.scheduled) {
      expect(s.at).toBeGreaterThanOrEqual(OUTER_DELAY_MIN);
      expect(s.at).toBeLessThanOrEqual(OUTER_DELAY_MAX);
      const x = fire.cellX(s.cell);
      const z = fire.cellZ(s.cell);
      const share = Math.hypot(x, z) / forest.edge.radiusAt(Math.atan2(z, x));
      // Small tolerance: the centre snaps to a grid cell.
      expect(share).toBeGreaterThan(OUTER_DEPTH_MIN - 0.02);
      expect(share).toBeLessThan(OUTER_DEPTH_MAX + 0.02);
    }
    const outer = [...fire.scheduled];
    run(fire, OUTER_DELAY_MAX + 1);
    expect(fire.scheduled).toEqual([]);
    for (const s of outer) expect(fire.state[s.cell]).not.toBe(CellState.Fresh);
  });

  it('spreads and leaves burnt cells behind', () => {
    const { fire } = setup();
    run(fire, 20);
    expect(count(fire, CellState.Burning)).toBeGreaterThan(27);
    expect(count(fire, CellState.Burnt)).toBeGreaterThan(0);
  });

  it('races downwind and barely moves upwind', () => {
    const forest = new Forest(mulberry32(3));
    const wind = new Wind(mulberry32(3));
    wind.angle = 0; // blowing towards +X
    const fire = new FireGrid(forest, mulberry32(42), wind);
    // Only the test fire at the start: clear the origins.
    fire.burning.length = 0;
    fire.scheduled.length = 0;
    fire.state.fill(CellState.Fresh);
    fire.ignite(fire.cellOf(0, 0));
    for (let t = 0; t < 12; t += DT) fire.update(DT); // wind kept fixed, no update
    let east = 0;
    let west = 0;
    fire.state.forEach((s, c) => {
      if (s === CellState.Fresh) return;
      east = Math.max(east, fire.cellX(c));
      west = Math.max(west, -fire.cellX(c));
    });
    expect(east).toBeGreaterThan(west * 2.5);
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

  it('hurts much more right inside the flames than just beside them', () => {
    const { fire } = setup();
    const c = fire.cellOf(0, 0); // the start area is free of other fires
    fire.ignite(c);
    run(fire, 1.5);
    const inside = fire.heatAt(fire.cellX(c), fire.cellZ(c));
    const beside = fire.heatAt(fire.cellX(c) + 0.9, fire.cellZ(c)); // just over the cell border
    expect(inside).toBeGreaterThan(beside * 3);
  });

  it('radiates more heat from a burning tree than from burning ground', () => {
    const { forest, fire } = setup();
    // Only the two test fires: clear the origins.
    fire.burning.length = 0;
    fire.scheduled.length = 0;
    fire.state.fill(CellState.Fresh);
    const tree = forest.trees.find((t) => Math.hypot(t.x, t.z) < 9)!;
    const treeCell = fire.cellOf(tree.x, tree.z);
    const groundCell = fire.cellOf(0, 0);
    fire.ignite(treeCell);
    fire.ignite(groundCell);
    run(fire, 1.5);
    const near = (c: number) => fire.heatAt(fire.cellX(c) + 1.2, fire.cellZ(c));
    expect(near(treeCell)).toBeGreaterThan(near(groundCell));
  });
});
