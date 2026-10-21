# Ashmane

Short, replayable browser game: a cotton-candy-pink horse has to escape a burning forest.
Built with Vite, TypeScript and Three.js. The scene is rendered into a small target and reduced
to a few colours with a Bayer dither shader.

## Requirements

- Node.js 20 or newer
- npm

## Commands

```sh
npm install        # install dependencies
npm run dev        # start the dev server and open the game in the browser
npm run build      # type-check and build into dist/
npm run preview    # serve the built version from dist/
npm run typecheck  # type-check only
npm test           # run the unit tests once
npm run test:watch # run the unit tests in watch mode
npm run balance    # let a bot play 160 runs and print how hard the game is
```

## Structure

```
src/
  main.ts          entry point, picks a seed and starts the game
  core/            game loop, input, seeded random
  sim/             simulation without rendering (horse, forest, fire grid)
  render/          Three.js renderer, dither pass and views
docs/prototype/    single-file look prototype (reference only)
```

Each forest is generated from a seed, which is logged to the browser console on start.

## Tuning

All gameplay values (map size, fire, wind, embers, horse) live in `src/sim/balance.ts`.
After changing them, `npm run balance` lets a simple bot flee from 160 forests and prints
how often it escapes and where it takes damage. The bot never avoids fire, so compare the
numbers before and after a change rather than reading them as absolute difficulty.

## Releases

Versions follow [Semantic Versioning](https://semver.org): patch for fixes and balance,
minor for new features. Notes for every version are in [CHANGELOG.md](CHANGELOG.md).

Branches: features are built on `feature/*` and merged into `develop`. `main` holds the
released versions only, and Vercel deploys production from `main` (other branches are not
deployed, see `vercel.json`).

To release:

1. On a `release/x.y.z` branch from `develop`, set the version in `package.json` and add the
   notes to `CHANGELOG.md`; merge it into `develop`.
2. Merge `develop` into `main`. Vercel deploys it.
3. Tag the release on `main` and push the tag: `git tag vx.y.z && git push origin vx.y.z`.
4. Create a GitHub release from the tag and paste the notes from the changelog.
