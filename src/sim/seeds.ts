/**
 * Each system draws from its own random stream derived from the run seed, so changing
 * how one of them uses randomness does not reshuffle the others (e.g. the forest layout).
 */
export const FIRE_SEED_SALT = 0x5f3759df;
export const WIND_SEED_SALT = 0x2545f491;
export const SPOT_SEED_SALT = 0x1b873593;
