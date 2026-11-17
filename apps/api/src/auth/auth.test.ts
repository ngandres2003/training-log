import { eq } from 'drizzle-orm'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { session, user, verification } from '../db/schema.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { createAuth } from './auth.js'
import { buildOtpEmail, createTestMailer, type TestMailer } from './mailer.js'

const BASE_URL = 'http://localhost:3000'
const SECRET = 'test-secret-0123456789-abcdefghijklmnop'

let t: TestDb
let mailer: TestMailer

beforeEach(async () => {
  t = await createTestDb()
  mailer = createTestMailer()
})

afterEach(async () => {
  await t.close()
})

/** An app instance on the shared test database; several instances stand in for serverless handlers. */
function makeApp() {
  return createApp({ auth: createAuth({ db: t.db, mailer, secret: SECRET, baseURL: BASE_URL }) })
}

function sendCode(app: ReturnType<typeof makeApp>, email: string, ip = '203.0.113.1') {
  return request(app)
    .post('/api/auth/email-otp/send-verification-otp')
    .set('Origin', BASE_URL)
    .set('X-Forwarded-For', ip)
    .send({ email, type: 'sign-in' })
}

function signIn(app: ReturnType<typeof makeApp>, email: string, otp: string, ip = '203.0.113.1') {
  return request(app)
    .post('/api/auth/sign-in/email-otp')
    .set('Origin', BASE_URL)
    .set('X-Forwarded-For', ip)
    .send({ email, otp })
}

function cookieHeader(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined
  return (raw ?? []).map((c) => c.split(';')[0]).join('; ')
}

/** A 6-digit code that differs from `code`. */
function wrong(code: string): string {
  return code === '000000' ? '111111' : '000000'
}

async function signInFully(app: ReturnType<typeof makeApp>, email: string) {
  expect((await sendCode(app, email)).status).toBe(200)
  const code = mailer.lastCodeFor(email)!
  const res = await signIn(app, email, code)
  expect(res.status).toBe(200)
  const me = await request(app).get('/api/me').set('Cookie', cookieHeader(res))
  expect(me.status).toBe(200)
  return me.body as { user: { id: string; email: string } }
}

describe('email-code authentication', () => {
  it('sends a 6-digit code whose email subject contains it', async () => {
    const app = makeApp()
    const res = await sendCode(app, 'Ana@Example.com')
    expect(res.status).toBe(200)
    const code = mailer.lastCodeFor('ana@example.com')
    expect(code).toMatch(/^\d{6}$/)
    expect(buildOtpEmail(code!).subject).toContain(code)
  })

  it('signs a new email in, creating a user row and a session', async () => {
    const app = makeApp()
    const me = await signInFully(app, 'ana@example.com')
    expect(me.user.email).toBe('ana@example.com')
    const users = await t.db.select().from(user)
    expect(users).toHaveLength(1)
    expect(users[0]!.id).toBe(me.user.id)
    const sessions = await t.db.select().from(session).where(eq(session.userId, me.user.id))
    expect(sessions).toHaveLength(1)
    // Session lasts 60 days (KTD3).
    const days = (sessions[0]!.expiresAt.getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(59.9)
    expect(days).toBeLessThanOrEqual(60)
  })

  it('signs an existing email in to the same user id', async () => {
    const app = makeApp()
    const first = await signInFully(app, 'ana@example.com')
    const second = await signInFully(app, 'ana@example.com')
    expect(second.user.id).toBe(first.user.id)
    expect(await t.db.select().from(user)).toHaveLength(1)
  })

  it('rejects a wrong code without creating a session', async () => {
    const app = makeApp()
    await sendCode(app, 'ana@example.com')
    const res = await signIn(app, 'ana@example.com', wrong(mailer.lastCodeFor('ana@example.com')!))
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_OTP')
    expect(res.headers['set-cookie']).toBeUndefined()
    expect(await t.db.select().from(session)).toHaveLength(0)
    expect(await t.db.select().from(user)).toHaveLength(0)
  })

  it('rejects an expired code', async () => {
    const app = makeApp()
    await sendCode(app, 'ana@example.com')
    const code = mailer.lastCodeFor('ana@example.com')!
    const stored = await t.db.select().from(verification)
    // The code was issued with a 10-minute expiry.
    const minutes = (stored[0]!.expiresAt.getTime() - Date.now()) / 60_000
    expect(minutes).toBeGreaterThan(9.9)
    expect(minutes).toBeLessThanOrEqual(10)
    await t.db.update(verification).set({ expiresAt: new Date(Date.now() - 1000) })
    const res = await signIn(app, 'ana@example.com', code)
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('OTP_EXPIRED')
    expect(await t.db.select().from(session)).toHaveLength(0)
  })

  it('invalidates a code after 5 wrong attempts, even if the right code comes next', async () => {
    const app = makeApp()
    await sendCode(app, 'ana@example.com')
    const code = mailer.lastCodeFor('ana@example.com')!
    for (let i = 0; i < 5; i++) {
      const res = await signIn(app, 'ana@example.com', wrong(code))
      expect(res.status).toBe(400)
    }
    const res = await signIn(app, 'ana@example.com', code)
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('TOO_MANY_ATTEMPTS')
    expect(await t.db.select().from(session)).toHaveLength(0)
  })

  it('refuses a fourth code request for the same email within 15 minutes, across handler instances and IPs', async () => {
    const a = makeApp()
    const b = makeApp()
    expect((await sendCode(a, 'ana@example.com', '198.51.100.1')).status).toBe(200)
    expect((await sendCode(b, 'ana@example.com', '198.51.100.2')).status).toBe(200)
    expect((await sendCode(a, 'ana@example.com', '198.51.100.3')).status).toBe(200)
    const fourth = await sendCode(b, 'ana@example.com', '198.51.100.4')
    expect(fourth.status).toBe(429)
    expect(Number(fourth.headers['x-retry-after'])).toBeGreaterThan(14 * 60)
    expect(mailer.sent.filter((m) => m.email === 'ana@example.com')).toHaveLength(3)
    // Another email is unaffected.
    expect((await sendCode(a, 'bea@example.com', '198.51.100.4')).status).toBe(200)
  })

  it('refuses an eleventh code request from one IP within 15 minutes', async () => {
    const app = makeApp()
    for (let i = 0; i < 10; i++) {
      expect((await sendCode(app, `u${i}@example.com`, '192.0.2.7')).status).toBe(200)
    }
    expect((await sendCode(app, 'u10@example.com', '192.0.2.7')).status).toBe(429)
  })
})

describe('require-session', () => {
  it('returns 401 for a protected route without a session cookie', async () => {
    const res = await request(makeApp()).get('/api/me')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'unauthorized' })
  })
})
