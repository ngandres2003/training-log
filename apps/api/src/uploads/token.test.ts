import { getPayloadFromClientToken } from '@vercel/blob/client'
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { createAuth, type Auth } from '../auth/auth.js'
import { createTestMailer, type TestMailer } from '../auth/mailer.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { createUploadsRouter } from './router.js'

const BASE_URL = 'http://localhost:3000'
const SECRET = 'test-secret-0123456789-abcdefghijklmnop'
const FAKE_BLOB_TOKEN = 'vercel_blob_rw_teststore123_fakesecretvalue'
const TWO_MB = 2 * 1024 * 1024

let t: TestDb
let mailer: TestMailer
let auth: Auth

beforeEach(async () => {
  t = await createTestDb()
  mailer = createTestMailer()
  auth = createAuth({ db: t.db, mailer, secret: SECRET, baseURL: BASE_URL })
})

afterEach(async () => {
  await t.close()
})

/** A throwaway app with only the uploads router mounted where the real app will mount it. */
function uploadsApp() {
  const app = express()
  app.use('/api/uploads', createUploadsRouter({ getAuth: () => auth, blobToken: FAKE_BLOB_TOKEN }))
  return app
}

async function signIn(email: string): Promise<{ id: string; cookie: string }> {
  const app = createApp({ auth })
  await request(app)
    .post('/api/auth/email-otp/send-verification-otp')
    .set('Origin', BASE_URL)
    .send({ email, type: 'sign-in' })
    .expect(200)
  const res = await request(app)
    .post('/api/auth/sign-in/email-otp')
    .set('Origin', BASE_URL)
    .send({ email, otp: mailer.lastCodeFor(email) })
    .expect(200)
  const raw = res.headers['set-cookie'] as unknown as string[]
  const cookie = raw.map((c) => c.split(';')[0]).join('; ')
  const me = await request(app).get('/api/me').set('Cookie', cookie).expect(200)
  return { id: (me.body as { user: { id: string } }).user.id, cookie }
}

describe('POST /api/uploads/token', () => {
  it('returns 401 without a session', async () => {
    const res = await request(uploadsApp()).post('/api/uploads/token').send({ contentType: 'image/webp' })
    expect(res.status).toBe(401)
  })

  it('issues a token for one server-chosen webp path under the caller prefix, ignoring a client pathname', async () => {
    const me = await signIn('ana@example.com')
    const before = Date.now()
    const res = await request(uploadsApp())
      .post('/api/uploads/token')
      .set('Cookie', me.cookie)
      .send({ contentType: 'image/webp', pathname: 'custom-exercises/someone-else/evil.webp' })
    expect(res.status).toBe(200)
    const { token, pathname } = res.body as { token: string; pathname: string }
    expect(pathname).toMatch(new RegExp(`^custom-exercises/${me.id}/[A-Za-z0-9_-]{22,}\\.webp$`))

    const payload = getPayloadFromClientToken(token)
    expect(payload.pathname).toBe(pathname)
    expect(payload.allowedContentTypes).toEqual(['image/webp'])
    expect(payload.maximumSizeInBytes).toBe(TWO_MB)
    expect(payload.addRandomSuffix).toBe(false)
    expect(payload.validUntil).toBeGreaterThan(before)
    expect(payload.validUntil).toBeLessThanOrEqual(Date.now() + 5 * 60_000)
  })

  it('uses a .jpg path for a JPEG and a fresh random path on every request', async () => {
    const me = await signIn('ana@example.com')
    const app = uploadsApp()
    const a = await request(app).post('/api/uploads/token').set('Cookie', me.cookie).send({ contentType: 'image/jpeg' })
    const b = await request(app).post('/api/uploads/token').set('Cookie', me.cookie).send({ contentType: 'image/jpeg' })
    expect(a.status).toBe(200)
    expect(a.body.pathname).toMatch(new RegExp(`^custom-exercises/${me.id}/.+\\.jpg$`))
    expect(getPayloadFromClientToken(a.body.token).allowedContentTypes).toEqual(['image/jpeg'])
    expect(b.body.pathname).not.toBe(a.body.pathname)
  })

  it('refuses an HTML file', async () => {
    const me = await signIn('ana@example.com')
    const res = await request(uploadsApp())
      .post('/api/uploads/token')
      .set('Cookie', me.cookie)
      .send({ contentType: 'text/html' })
    expect(res.status).toBe(400)
    expect(res.body.token).toBeUndefined()
  })

  it('refuses a 5 MB image', async () => {
    const me = await signIn('ana@example.com')
    const res = await request(uploadsApp())
      .post('/api/uploads/token')
      .set('Cookie', me.cookie)
      .send({ contentType: 'image/webp', size: 5 * 1024 * 1024 })
    expect(res.status).toBe(400)
    expect(res.body.token).toBeUndefined()
  })
})
