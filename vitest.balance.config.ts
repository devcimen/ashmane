import { defineConfig } from 'vitest/config';

/** Separate config so `npm test` stays fast; `npm run balance` runs only the balance check. */
export default defineConfig({
  test: {
    include: ['src/**/*.check.ts'],
  },
});
