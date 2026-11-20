import { defineConfig } from 'vitest/config'

/** Smoke tests against a deployed URL; not part of `pnpm test`. See smoke.test.ts. */
export default defineConfig({
  test: {
    include: ['smoke/**/*.test.ts'],
    testTimeout: 20_000,
    retry: 1,
  },
})
