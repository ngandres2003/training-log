import { eq } from 'drizzle-orm'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { account, invites, session, settings, syncCounters, user } from '../db/schema.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { createInvite, hashToken } from '../invites/invites.js'
import { adminEmailsFromEnv } from './admins.js'
import { createAuth } from './auth.js'
import { cookieHeader, signInForTest, TEST_BASE_URL, TEST_SECRET, testIp } from './test-helpers.js'

const ADMIN = 'admin@example.com'
const PASSWORD = 'una-contraseña-larga'

let t: TestDb

beforeEach(async () => {
  t = await createTestDb()
})

afterEach(async () => {
  await t.close()
})

/** An app instance on the shared test database; several instances stand in for serverless handlers. */
function makeApp() {
  return createApp({
    auth: createAuth({ db: t.db, secret: TEST_SECRET, baseURL: TEST_BASE_URL }),
    db: t.db,
    adminEmails: [ADMIN],
  })
}

type App = ReturnType<typeof makeApp>

function post(app: App, path: string, body: object, ip = testIp()) {
  return request(app).post(path).set('Origin', TEST_BASE_URL).set('X-Forwarded-For', ip).send(body)
}

function signIn(app: App, email: string, password: string, ip = testIp()) {
  return post(app, '/api/auth/sign-in/email', { email, password }, ip)
}

function redeem(app: App, token: string, password = PASSWORD) {
  return post(app, '/api/invites/redeem', { token, password })
}

async function me(app: App, cookie: string) {
  return request(app).get('/api/me').set('Cookie', cookie)
}

/** A token from the admin route, as the Perfil "Invitar" section gets it. */
async function adminInvite(app: App, adminCookie: string, email: string): Promise<string> {
  const res = await request(app).post('/api/invites').set('Cookie', adminCookie).send({ email })
  expect(res.status).toBe(201)
  const path = res.body.path as string
  expect(path).toMatch(/^\/invitacion\/[A-Za-z0-9_-]{43}$/)
  return path.slice('/invitacion/'.length)
}

describe('invites (admin)', () => {
  it('only admins create, list and revoke invites', async () => {
    const app = makeApp()
    const ana = await signInForTest(app, t.db, 'ana@example.com')
    expect((await me(app, ana.cookie)).body.isAdmin).toBe(false)
    expect((await request(app).post('/api/invites').send({ email: 'x@example.com' })).status).toBe(401)
    expect((await request(app).post('/api/invites').set('Cookie', ana.cookie).send({ email: 'x@example.com' })).status).toBe(403)
    expect((await request(app).get('/api/invites').set('Cookie', ana.cookie)).status).toBe(403)
    expect((await request(app).delete('/api/invites/whatever').set('Cookie', ana.cookie)).status).toBe(403)
    expect(await t.db.select().from(invites)).toHaveLength(1) // only the helper's own invite

    const admin = await signInForTest(app, t.db, 'Admin@Example.com')
    expect((await me(app, admin.cookie)).body.isAdmin).toBe(true)
    const res = await request(app).post('/api/invites').set('Cookie', admin.cookie).send({ email: ' Bea@Example.com ' })
    expect(res.status).toBe(201)
    expect(res.body.invite).toMatchObject({ email: 'bea@example.com', status: 'pending', usedAt: null })
    const days = (Date.parse(res.body.invite.expiresAt) - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(6.99)
    expect(days).toBeLessThanOrEqual(7)

    const list = await request(app).get('/api/invites').set('Cookie', admin.cookie)
    expect(list.body.invites.map((i: { email: string }) => i.email)).toContain('bea@example.com')

    const id = res.body.invite.id as string
    expect((await request(app).delete(`/api/invites/${id}`).set('Cookie', admin.cookie)).status).toBe(200)
    expect((await request(app).delete(`/api/invites/${id}`).set('Cookie', admin.cookie)).status).toBe(404)
    const token = res.body.path.slice('/invitacion/'.length)
    const revoked = await redeem(app, token)
    expect(revoked.status).toBe(410)
    expect(revoked.body.error).toBe('invite_revoked')
  })

  it('rejects an invalid email', async () => {
    const app = makeApp()
    const admin = await signInForTest(app, t.db, ADMIN)
    const res = await request(app).post('/api/invites').set('Cookie', admin.cookie).send({ email: 'no-es-un-email' })
    expect(res.status).toBe(400)
  })

  it('stores only a hash of the token', async () => {
    const { token } = await createInvite(t.db, { email: 'ana@example.com' })
    expect(token.length).toBeGreaterThanOrEqual(43) // 32 bytes in base64url
    const [row] = await t.db.select().from(invites)
    expect(row!.tokenHash).toBe(hashToken(token))
    expect(JSON.stringify(row)).not.toContain(token)
  })

  it('a new invite for the same email revokes the pending one', async () => {
    const app = makeApp()
    const admin = await signInForTest(app, t.db, ADMIN)
    const first = await adminInvite(app, admin.cookie, 'bea@example.com')
    const second = await adminInvite(app, admin.cookie, 'bea@example.com')
    const old = await redeem(app, first)
    expect(old.status).toBe(410)
    expect(old.body.error).toBe('invite_revoked')
    expect((await redeem(app, second)).status).toBe(200)
  })

  it('reads ADMIN_EMAILS as a comma-separated, case-insensitive list', () => {
    expect(adminEmailsFromEnv(' A@x.com, b@Y.com ,,')).toEqual(['a@x.com', 'b@y.com'])
    expect(adminEmailsFromEnv(undefined)).toEqual([])
  })
})

describe('redeeming an invite', () => {
  it('creates the account and a 60-day session', async () => {
    const app = makeApp()
    const { token } = await createInvite(t.db, { email: 'Ana@Example.com' })
    const check = await post(app, '/api/invites/check', { token })
    expect(check.body).toEqual({ email: 'ana@example.com', status: 'pending', hasAccount: false })

    const res = await redeem(app, token)
    expect(res.status).toBe(200)
    expect(res.body.created).toBe(true)
    const body = (await me(app, cookieHeader(res))).body
    expect(body.user.email).toBe('ana@example.com')
    expect(body.user.id).toBe(res.body.user.id)

    const users = await t.db.select().from(user)
    expect(users).toHaveLength(1)
    const [cred] = await t.db.select().from(account).where(eq(account.userId, users[0]!.id))
    expect(cred!.providerId).toBe('credential')
    expect(cred!.password).not.toContain(PASSWORD)
    const sessions = await t.db.select().from(session).where(eq(session.userId, users[0]!.id))
    expect(sessions).toHaveLength(1)
    const days = (sessions[0]!.expiresAt.getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(59.9)
    expect(days).toBeLessThanOrEqual(60)
  })

  it('works once: a second redeem fails', async () => {
    const app = makeApp()
    const { token } = await createInvite(t.db, { email: 'ana@example.com' })
    expect((await redeem(app, token)).status).toBe(200)
    const again = await redeem(app, token, 'otra-contraseña-larga')
    expect(again.status).toBe(410)
    expect(again.body.error).toBe('invite_used')
    expect(again.headers['set-cookie']).toBeUndefined()
    expect((await post(app, '/api/invites/check', { token })).body.status).toBe('used')
  })

  it('fails when expired', async () => {
    const app = makeApp()
    const { token } = await createInvite(t.db, { email: 'ana@example.com' })
    await t.db.update(invites).set({ expiresAt: new Date(Date.now() - 1000) })
    const res = await redeem(app, token)
    expect(res.status).toBe(410)
    expect(res.body.error).toBe('invite_expired')
    expect(await t.db.select().from(user)).toHaveLength(0)
  })

  it('fails for an unknown token', async () => {
    const app = makeApp()
    const res = await redeem(app, 'x'.repeat(43))
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('invite_invalid')
    expect((await post(app, '/api/invites/check', { token: 'nope' })).status).toBe(404)
  })

  it('refuses a password under 8 characters without using the invite', async () => {
    const app = makeApp()
    const { token } = await createInvite(t.db, { email: 'ana@example.com' })
    const res = await redeem(app, token, '1234567')
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_password')
    expect((await redeem(app, token)).status).toBe(200)
  })

  it('for an existing email sets a new password on the same account and keeps its data', async () => {
    const app = makeApp()
    const ana = await signInForTest(app, t.db, 'ana@example.com', 'contraseña-olvidada')
    // Some synced data that must survive the reset.
    await t.db.insert(syncCounters).values({ userId: ana.id, value: 3 })
    await t.db.insert(settings).values({
      id: '0190f5a2-7b1c-7d3e-8f00-000000000001',
      userId: ana.id,
      version: 1,
      updatedAt: new Date(),
      deletedAt: null,
      displayName: 'Ana',
      unit: 'kg',
      weeklyGoal: 3,
      weekStart: 'monday',
      theme: 'dark',
      preloadPrevious: true,
      soundOn: true,
      vibrationOn: true,
      keepScreenOn: false,
      onboardedAt: null,
    })

    const { token } = await createInvite(t.db, { email: 'ana@example.com' })
    expect((await post(app, '/api/invites/check', { token })).body.hasAccount).toBe(true)
    const res = await redeem(app, token, 'contraseña-nueva-1')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ user: { id: ana.id }, created: false })
    expect((await me(app, cookieHeader(res))).body.user.id).toBe(ana.id)

    // The old session ended; the old password no longer works, the new one does.
    expect((await me(app, ana.cookie)).status).toBe(401)
    expect((await signIn(app, 'ana@example.com', 'contraseña-olvidada')).status).toBe(401)
    expect((await signIn(app, 'ana@example.com', 'contraseña-nueva-1')).status).toBe(200)

    expect(await t.db.select().from(user)).toHaveLength(1)
    expect(await t.db.select().from(settings).where(eq(settings.userId, ana.id))).toHaveLength(1)
    expect((await t.db.select().from(syncCounters))[0]!.value).toBe(3)
  })
})

describe('password sign-in', () => {
  it('signs in with the right password and refuses a wrong one', async () => {
    const app = makeApp()
    const ana = await signInForTest(app, t.db, 'ana@example.com', PASSWORD)

    const ok = await signIn(app, 'Ana@Example.com', PASSWORD)
    expect(ok.status).toBe(200)
    expect((await me(app, cookieHeader(ok))).body.user.id).toBe(ana.id)

    const wrong = await signIn(app, 'ana@example.com', 'contraseña-mala')
    expect(wrong.status).toBe(401)
    expect(wrong.body.code).toBe('INVALID_EMAIL_OR_PASSWORD')
    expect(wrong.headers['set-cookie']).toBeUndefined()

    const unknown = await signIn(app, 'nadie@example.com', PASSWORD)
    expect(unknown.status).toBe(401)
  })

  it('has self sign-up disabled', async () => {
    const app = makeApp()
    const res = await post(app, '/api/auth/sign-up/email', {
      email: 'intruso@example.com',
      password: 'una-contraseña-larga',
      name: 'X',
    })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('EMAIL_PASSWORD_SIGN_UP_DISABLED')
    expect(await t.db.select().from(user)).toHaveLength(0)
  })

  it('limits attempts per email and IP, with a separate bucket for another IP', async () => {
    const app = makeApp()
    await signInForTest(app, t.db, 'ana@example.com', PASSWORD)
    const a = '203.0.113.10'
    const b = '203.0.113.20'
    for (let i = 0; i < 5; i++) expect((await signIn(app, 'ana@example.com', 'mala-contraseña', a)).status).toBe(401)
    const blocked = await signIn(app, 'ana@example.com', PASSWORD, a)
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers['x-retry-after'])).toBeGreaterThan(14 * 60)
    // Another IP keeps its own bucket, across handler instances.
    expect((await signIn(makeApp(), 'ana@example.com', PASSWORD, b)).status).toBe(200)
  })

  it("redeeming a new link clears the email's sign-in limit", async () => {
    const app = makeApp()
    await signInForTest(app, t.db, 'ana@example.com', PASSWORD)
    const ip = '203.0.113.30'
    for (let i = 0; i < 6; i++) await signIn(app, 'ana@example.com', 'mala-contraseña', ip)
    expect((await signIn(app, 'ana@example.com', PASSWORD, ip)).status).toBe(429)

    const { token } = await createInvite(t.db, { email: 'ana@example.com' })
    expect((await post(app, '/api/invites/redeem', { token, password: 'contraseña-nueva-2' }, ip)).status).toBe(200)
    expect((await signIn(app, 'ana@example.com', 'contraseña-nueva-2', ip)).status).toBe(200)
  })

  it('limits redeem attempts per IP', async () => {
    const app = makeApp()
    const ip = '203.0.113.40'
    for (let i = 0; i < 10; i++) {
      expect((await post(app, '/api/invites/redeem', { token: `t${i}`, password: PASSWORD }, ip)).status).toBe(404)
    }
    expect((await post(app, '/api/invites/redeem', { token: 'x', password: PASSWORD }, ip)).status).toBe(429)
    expect((await post(app, '/api/invites/redeem', { token: 'x', password: PASSWORD }, '203.0.113.41')).status).toBe(404)
  })
})

describe('require-session', () => {
  it('returns 401 for a protected route without a session cookie', async () => {
    const res = await request(makeApp()).get('/api/me')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'unauthorized' })
  })

  it('does not advertise Express', async () => {
    const res = await request(makeApp()).get('/api/health')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})
