import { FOREST_RADIUS_MAX } from './balance';

/** Open meadow between the furthest forest edge and the end of the world. */
const MEADOW_WIDTH = 20;

/** The world is a square cell grid centred at the origin, big enough for forest and meadow. */
export const CELL_SIZE = 1.6;
export const GRID_SIZE = Math.ceil((2 * (FOREST_RADIUS_MAX + MEADOW_WIDTH)) / CELL_SIZE);
export const WORLD_HALF = (GRID_SIZE * CELL_SIZE) / 2;
