import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end suite (U18). Two modes:
 *
 * - Local (default): builds the SPA for production, serves it with `vite preview` on one origin
 *   that proxies `/api` to a test-only API process (`apps/api/src/e2e-server.ts`): the real app on
 *   an in-memory Postgres (PGlite) with a mailer sink that the specs read codes from.
 * - Preview: set `BASE_URL` to a deployed preview. Codes are read from that deployment's database
 *   (`E2E_DATABASE_URL`, the preview's Neon branch; codes are stored in plain text outside
 *   production), and `VERCEL_AUTOMATION_BYPASS_SECRET` is sent to pass Deployment Protection.
 *   See docs/deploy.md.
 */
const WEB_PORT = 4174
const API_PORT = 3101
const remoteBaseURL = process.env.BASE_URL
const localBaseURL = `http://localhost:${WEB_PORT}`
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

export default defineConfig({
  testDir: './e2e',
  // One shared API and its per-path rate limits: run the journeys one after another.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: remoteBaseURL ?? localBaseURL,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    extraHTTPHeaders: bypass
      ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' }
      : undefined,
  },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'], browserName: 'chromium' } }],
  webServer: remoteBaseURL
    ? undefined
    : [
        {
          command: 'npx tsx src/e2e-server.ts',
          cwd: '../api',
          url: `http://localhost:${API_PORT}/api/health`,
          env: {
            E2E_TEST_MODE: '1',
            NODE_ENV: 'test',
            PORT: String(API_PORT),
            BETTER_AUTH_URL: localBaseURL,
          },
          reuseExistingServer: false,
          timeout: 60_000,
          stdout: 'pipe',
        },
        {
          command: `npm run build && npx vite preview --port ${WEB_PORT} --strictPort`,
          url: localBaseURL,
          env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
          reuseExistingServer: false,
          timeout: 240_000,
        },
      ],
})
