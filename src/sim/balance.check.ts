/**
 * Balance check: a simple bot flees from the centre of many forests and the results are
 * summed up. Run with `npm run balance` after changing values in balance.ts.
 *
 * The bot runs straight outwards in a fixed direction and only steers around trees; it
 * never avoids fire. A human does much better, so read the numbers relative to each other:
 * did a change make the game harder or easier, and where (in the middle or further out)?
 */
import { it } from 'vitest';
import { mulberry32 } from '../core/random';
import { HORSE_RADIUS } from './balance';
import { FireGrid } from './FireGrid';
import { Forest } from './Forest';
import { Horse } from './Horse';
import { FIRE_SEED_SALT, SPOT_SEED_SALT, WIND_SEED_SALT } from './seeds';
import { Spotting } from './Spotting';
import { Wind } from './Wind';

const FORESTS = 20;
const DIRECTIONS = 8;
const DT = 1 / 30;
/** Matches the wake-up time in Game: the fire already burns while the horse gets up. */
const WAKE_TIME = 3.4;
const TIME_LIMIT = 120;
/** "The middle": inside this radius are the big inner fires. */
const MIDDLE_RADIUS = 35;
/** When the bot is stuck at a tree, it veers off for a moment. */
const STUCK_SPEED = 1.5;
const STUCK_TIME = 0.4;
const DETOUR_TIME = 0.8;
const DETOUR_ANGLE = 1.1;

type Outcome = 'escaped' | 'dead' | 'timeout';

interface RunResult {
  outcome: Outcome;
  time: number;
  damageMiddle: number;
  damageOutside: number;
  leftMiddle: boolean;
}

function runBot(seed: number, angle: number): RunResult {
  const forest = new Forest(mulberry32(seed));
  const wind = new Wind(mulberry32(seed ^ WIND_SEED_SALT));
  const fire = new FireGrid(forest, mulberry32(seed ^ FIRE_SEED_SALT), wind);
  const spotting = new Spotting(fire, forest, wind, mulberry32(seed ^ SPOT_SEED_SALT));
  const horse = new Horse();
  const step = () => {
    wind.update(DT);
    fire.update(DT);
    spotting.update(DT, horse);
  };
  for (let t = 0; t < WAKE_TIME; t += DT) step();

  const result: RunResult = { outcome: 'timeout', time: 0, damageMiddle: 0, damageOutside: 0, leftMiddle: false };
  let stuck = 0;
  let detour = 0;
  let detourSide = 1;
  for (let t = 0; t < TIME_LIMIT; t += DT) {
    const a = angle + (detour > 0 ? detourSide * DETOUR_ANGLE : 0);
    horse.setDirection(Math.cos(a), Math.sin(a));
    horse.update(DT);
    const hit = forest.collide(horse.x, horse.z, HORSE_RADIUS);
    if (hit) {
      horse.x = hit.x;
      horse.z = hit.z;
      horse.bump(hit.nx, hit.nz);
    }
    step();
    horse.applyHeat(fire.heatAt(horse.x, horse.z), DT);
    horse.applyGround(fire.isBurntAt(horse.x, horse.z), DT);

    if (Math.hypot(horse.x, horse.z) < MIDDLE_RADIUS) {
      result.damageMiddle += horse.lastDamage;
    } else {
      result.damageOutside += horse.lastDamage;
      result.leftMiddle = true;
    }
    stuck = horse.speed < STUCK_SPEED ? stuck + DT : 0;
    if (stuck > STUCK_TIME && detour <= 0) {
      detour = DETOUR_TIME;
      detourSide = -detourSide;
    }
    detour -= DT;
    result.time = t;
    if (!horse.alive) return { ...result, outcome: 'dead' };
    if (!forest.edge.contains(horse.x, horse.z)) return { ...result, outcome: 'escaped' };
  }
  return result;
}

it('balance check', () => {
  const runs: RunResult[] = [];
  for (let seed = 1; seed <= FORESTS; seed++) {
    for (let k = 0; k < DIRECTIONS; k++) runs.push(runBot(seed, (k / DIRECTIONS) * Math.PI * 2));
  }
  const share = (n: number, of: number) => `${Math.round((100 * n) / Math.max(1, of))} %`;
  const avg = (values: number[]) => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  const escaped = runs.filter((r) => r.outcome === 'escaped');
  const dead = runs.filter((r) => r.outcome === 'dead');
  const leftMiddle = runs.filter((r) => r.leftMiddle);
  const diedOutside = leftMiddle.filter((r) => r.outcome === 'dead');

  console.log(
    [
      '',
      `Balance check: ${FORESTS} forests × ${DIRECTIONS} directions = ${runs.length} runs`,
      `  escaped                       ${share(escaped.length, runs.length).padStart(5)}   (avg ${avg(escaped.map((r) => r.time)).toFixed(1)} s)`,
      `  died                          ${share(dead.length, runs.length).padStart(5)}`,
      `  timed out                     ${share(runs.length - escaped.length - dead.length, runs.length).padStart(5)}`,
      `  avg damage in the middle      ${avg(runs.map((r) => r.damageMiddle)).toFixed(1).padStart(5)}`,
      `  avg damage further out        ${avg(runs.map((r) => r.damageOutside)).toFixed(1).padStart(5)}`,
      `  died after leaving the middle ${share(diedOutside.length, leftMiddle.length).padStart(5)}   (${diedOutside.length} of ${leftMiddle.length})`,
      '',
    ].join('\n'),
  );
}, 120_000);
