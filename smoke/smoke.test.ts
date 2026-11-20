/**
 * Smoke tests: a fast, read-only check of a deployed environment (preview or production).
 * They create nothing and need no account: they prove the deployment is up, routed correctly,
 * and that protected and test-only routes are closed.
 *
 *   SMOKE_BASE_URL=https://<deployment> pnpm test:smoke
 *   VERCEL_AUTOMATION_BYPASS_SECRET=<secret>   # only for previews behind Deployment Protection
 */
import { describe, expect, it } from 'vitest'

const BASE_URL = (process.env.SMOKE_BASE_URL ?? '').replace(/\/$/, '')
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

function get(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (BYPASS) headers.set('x-vercel-protection-bypass', BYPASS)
  return fetch(`${BASE_URL}${path}`, { redirect: 'manual', ...init, headers })
}

function postJson(path: string, body: unknown): Promise<Response> {
  return get(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE_URL },
    body: JSON.stringify(body),
  })
}

describe.skipIf(!BASE_URL)(`smoke: ${BASE_URL || '(SMOKE_BASE_URL not set)'}`, () => {
  describe('web', () => {
    it('serves the app shell', async () => {
      const res = await get('/')
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/html')
      expect(await res.text()).toContain('<div id="root">')
    })

    it('serves deep links through the SPA rewrite', async () => {
      for (const path of ['/historial', '/progreso', '/invitacion/abc']) {
        const res = await get(path)
        expect(res.status, path).toBe(200)
        expect(await res.text(), path).toContain('<div id="root">')
      }
    })

    it('ships the PWA manifest and service worker', async () => {
      const manifest = await get('/manifest.webmanifest')
      expect(manifest.status).toBe(200)
      expect(await manifest.json()).toMatchObject({ name: expect.any(String) })
      expect((await get('/sw.js')).status).toBe(200)
    })

    it('sends the security headers', async () => {
      const res = await get('/')
      expect(res.headers.get('x-content-type-options')).toBe('nosniff')
      expect(res.headers.get('referrer-policy')).toBeTruthy()
      expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
      expect(res.headers.get('strict-transport-security')).toBeTruthy()
    })
  })

  describe('api', () => {
    it('is healthy', async () => {
      const res = await get('/api/health')
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ ok: true })
    })

    it('answers unknown API paths with a JSON 404, not the SPA', async () => {
      const res = await get('/api/no-existe')
      expect(res.status).toBe(404)
      expect(res.headers.get('content-type')).toContain('application/json')
    })

    it('does not reveal the server framework', async () => {
      expect((await get('/api/health')).headers.get('x-powered-by')).toBeNull()
    })

    it('rejects protected routes without a session', async () => {
      expect((await get('/api/me')).status).toBe(401)
      expect((await get('/api/sync/pull')).status).toBe(401)
      expect((await postJson('/api/sync/push', { contractVersion: 2, changes: [] })).status).toBe(401)
      expect((await get('/api/invites')).status).toBe(401)
      expect((await postJson('/api/invites', { email: 'x@example.com' })).status).toBe(401)
      expect((await postJson('/api/uploads/token', { contentType: 'image/webp' })).status).toBe(401)
      expect((await get('/api/account', { method: 'DELETE' })).status).toBe(401)
    })

    it('has open sign-up disabled', async () => {
      const res = await postJson('/api/auth/sign-up/email', {
        email: `smoke-${Date.now()}@example.com`,
        password: 'smoke-password-123',
        name: '',
      })
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('rejects an invalid invitation token', async () => {
      const res = await postJson('/api/invites/check', { token: 'not-a-real-token' })
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
    })

    it('does not expose the test-only routes', async () => {
      expect((await postJson('/api/__e2e/invite', { email: 'a@b.c' })).status).toBe(404)
    })
  })
})
