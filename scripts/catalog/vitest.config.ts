import { defineProject } from 'vitest/config'

// Run with `pnpm vitest run --config scripts/catalog/vitest.config.ts`.
// The root config only lists packages/* and apps/* as projects.
export default defineProject({
  test: { name: 'catalog', environment: 'node', root: import.meta.dirname },
})
