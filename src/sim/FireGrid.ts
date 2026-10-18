import { CELL_SIZE, GRID_SIZE, WORLD_HALF } from './world';

export const CellState = {
  Fresh: 0,
  Burning: 1,
  Burnt: 2,
} as const;
export type CellState = (typeof CellState)[keyof typeof CellState];

/** Fire simulation on a square cell grid. Pure logic, no rendering. */
export class FireGrid {
  readonly size = GRID_SIZE;
  readonly state = new Uint8Array(GRID_SIZE * GRID_SIZE);

  /** Cell index for a world position, or -1 outside the grid. */
  cellOf(x: number, z: number): number {
    const i = Math.floor((x + WORLD_HALF) / CELL_SIZE);
    const j = Math.floor((z + WORLD_HALF) / CELL_SIZE);
    if (i < 0 || j < 0 || i >= this.size || j >= this.size) return -1;
    return j * this.size + i;
  }

  update(_dt: number): void {
    // Spreading comes with the gameplay step.
  }
}
