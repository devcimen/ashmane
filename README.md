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
