import { defineConfig } from 'vitest/config';

/**
 * Shared Vitest settings for every workspace package.
 *
 * Vitest 5 narrowed its default `exclude` to `node_modules` and `.git`; earlier
 * versions also excluded `dist`. Every package here compiles `src/**\/*.test.ts`
 * into `dist`, so without this a package that had been built would collect each
 * test twice — once from source and once from the stale compiled copy, which
 * fails as soon as the two disagree.
 *
 * `root` is left alone so it resolves to the package directory the command runs
 * in, not to this file's location.
 */
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
  },
});
