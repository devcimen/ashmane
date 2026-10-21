/**
 * All gameplay values in one place, for tuning the difficulty.
 * After changing something, `npm run balance` shows how a simple bot fares with the new values.
 */

// ─── Map ─────────────────────────────────────────────────────────────────────

/** Closest the forest edge comes to the centre, in world units. */
export const FOREST_RADIUS_MIN = 90;
/** Furthest the forest edge reaches from the centre, in world units. */
export const FOREST_RADIUS_MAX = 150;
/** Trees per square unit deep inside the forest. */
export const TREE_DENSITY = 0.016;
/** Minimum distance between two tree centres. */
export const MIN_SPACING = 3;
/** Radius around the start (origin) that stays free of trees. */
export const CLEAR_RADIUS = 5;
/** Over this distance before the edge the forest thins out. */
export const THIN_OUT_DEPTH = 25;
/** Share of trees that remain right at the edge. */
export const EDGE_DENSITY = 0.3;
/** Range of tree sizes. */
export const MIN_SCALE = 0.85;
export const MAX_SCALE = 1.45;
/** Share of the crown radius that blocks movement: between trunk and full crown. */
export const COLLISION_FACTOR = 0.5;

// ─── Horse ───────────────────────────────────────────────────────────────────

/** Units per second at full gallop. */
export const MAX_SPEED = 8;
/** How quickly speed approaches its target while a direction is held (1/s). Higher = snappier. */
export const SPEED_RESPONSE = 3.5;
/** How quickly the horse coasts to a stop when no direction is held (1/s). */
export const BRAKE_RESPONSE = 3;
/** Below this speed a coasting horse comes to a full stop. */
export const STOP_SPEED = 0.05;
/** Turning rate when standing or walking (radians/s): can turn almost on the spot. */
export const TURN_SLOW = 6;
/** Turning rate at full gallop (radians/s): only wide arcs. */
export const TURN_FAST = 2.5;
/** Lowest speed factor in sharp turns; a U-turn slows down to this share of MAX_SPEED. */
export const CORNER_SPEED_MIN = 0.25;
/** Size of the horse as a circle on the ground, for collisions. */
export const HORSE_RADIUS = 0.45;

export const MAX_HEALTH = 100;
/** Health lost per second per unit of heat (one full-strength flame right next to the horse ≈ 1). */
export const DAMAGE_PER_HEAT = 8;
/** Extra damage per second spent in the heat without a break (0.5 = +50 % per second). */
export const EXPOSURE_GAIN = 0.5;
/** Exposure stops growing after this many seconds. */
export const EXPOSURE_MAX = 4;
/** Seconds of exposure that wear off per second out of the heat. */
export const EXPOSURE_RECOVERY = 1;

/** Seconds a standing horse takes to sink completely into burnt ground. */
export const SINK_TIME = 6;
/** At full gallop the horse sinks only at this share of the standing rate. */
export const SINK_GALLOP_SHARE = 0.08;
/** Off the ash the horse climbs back out this many times faster than it sank. */
export const SINK_RECOVERY = 2;
/** Share of the top speed lost when sunk in completely; it is like running through quicksand. */
export const SINK_SLOWDOWN = 0.5;

// ─── Fire origins ────────────────────────────────────────────────────────────

/** Inner ring: big fires around the start that burn from the first second. */
export const INNER_ORIGIN_COUNT = 3;
export const INNER_DISTANCE_MIN = 15;
export const INNER_DISTANCE_MAX = 30;
/** Radius of the burning patch each inner origin starts with, in cells. */
export const INNER_PATCH_RADIUS = 3;
/** Outer ring: small fires further out that flare up later, so escaping the middle is not the end. */
export const OUTER_ORIGIN_COUNT_MIN = 2;
export const OUTER_ORIGIN_COUNT_MAX = 3;
/** How far towards the forest edge the outer origins lie, as a share of the edge distance. */
export const OUTER_DEPTH_MIN = 0.5;
export const OUTER_DEPTH_MAX = 0.85;
export const OUTER_PATCH_RADIUS = 1;
/** Seconds into the run when the outer origins flare up. */
export const OUTER_DELAY_MIN = 10;
export const OUTER_DELAY_MAX = 40;
/** Random deviation from evenly spaced directions (radians, ±). */
export const ORIGIN_ANGLE_JITTER = 0.5;

// ─── Fire spread ─────────────────────────────────────────────────────────────

/** Chance per second that a burning cell sets a direct neighbour alight, at the start of a run. */
export const SPREAD_RATE = 0.2;
/** How much faster the spreading gets per second of run time (0.02 = +2 % per second). */
export const SPREAD_GROWTH = 0.02;
/** Trees catch fire more easily than bare ground. */
export const TREE_CATCH_FACTOR = 2.5;
/** Downwind spread at normal wind strength: 1 + this (5 → 6× as fast). */
export const WIND_SPREAD = 5;
/** Spread against the wind never drops below this share. */
export const WIND_MIN_FACTOR = 0.15;
/** Diagonal neighbours are further away, so they catch less often. */
export const DIAGONAL_FACTOR = 0.7;
/** Burn duration ranges in seconds. */
export const GROUND_BURN_MIN = 6;
export const GROUND_BURN_MAX = 9;
export const TREE_BURN_MIN = 13;
export const TREE_BURN_MAX = 18;
/** Seconds until a fresh fire reaches full strength, and before burning out it fades. */
export const FLARE_UP = 1.2;
export const DIE_DOWN = 2.2;
/** Seconds until a fresh fire spreads at full rate. */
export const SPREAD_RAMP = 1.5;

// ─── Heat ────────────────────────────────────────────────────────────────────

/** Burning cells within this distance radiate heat. */
export const HEAT_RADIUS = 3;
/** A burning tree radiates this much more heat than burning ground. */
export const TREE_HEAT_FACTOR = 1.6;
/** Heat multiplier when the cell under the horse is burning itself. */
export const IN_FIRE_FACTOR = 2;

// ─── Wind ────────────────────────────────────────────────────────────────────

/** Seconds between new target directions. */
export const WIND_CHANGE_INTERVAL_MIN = 15;
export const WIND_CHANGE_INTERVAL_MAX = 35;
/** Largest change of the target direction at once (radians, ±). */
export const WIND_CHANGE_MAX = Math.PI / 2;
/** How fast the wind turns towards its target direction (radians/s). */
export const WIND_TURN_RATE = 0.12;
/** Average strength; 1 is a normal wind, 0 is calm. */
export const WIND_STRENGTH = 1;
/** Gusts: strength wobbles by this share around the average. */
export const WIND_GUST = 0.3;

// ─── Embers ──────────────────────────────────────────────────────────────────

/** Chance per second that a strongly burning tree throws an ember downwind. */
export const TREE_SPOT_RATE = 0.03;
/** Trees throw embers only while burning at least this strongly. */
export const TREE_SPOT_INTENSITY = 0.7;
export const TREE_SPOT_DISTANCE_MIN = 6;
export const TREE_SPOT_DISTANCE_MAX = 20;
/** Spread of the throw direction around the wind (radians, ±). */
export const TREE_SPOT_SPREAD = 0.5;

/** Seconds between embers that land ahead of the running horse. */
export const AHEAD_INTERVAL_MIN = 6;
export const AHEAD_INTERVAL_MAX = 12;
/** Only when a fire is within this distance of the horse. */
export const AHEAD_FIRE_RANGE = 45;
/** Only while the horse runs at least this fast. */
export const AHEAD_MIN_SPEED = 2;
/** How far ahead of the horse the ember lands, and how far it may deviate sideways (radians, ±). */
export const AHEAD_DISTANCE_MIN = 14;
export const AHEAD_DISTANCE_MAX = 22;
export const AHEAD_SPREAD = 0.4;
/** Never closer to the horse than this when it lands, so it is never unavoidable. */
export const AHEAD_SAFE_DISTANCE = 10;

/** Ember flight speed (units/s); longer throws stay in the air longer. */
export const FLIGHT_SPEED = 14;
/** Size of the fire patch a landing ember starts, in cells. */
export const SPOT_PATCH_RADIUS = 1;
