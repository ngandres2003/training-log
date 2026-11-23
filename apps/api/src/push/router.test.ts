import express, { type RequestHandler } from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pushSubscriptions, restAlerts } from '../db/schema.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { relaySignature, type PushSender, type VapidConfig } from './push.js'
import { createPushRouter, GRACE_MS, isPushEndpoint, MAX_WAIT_MS } from './router.js'

const VAPID: VapidConfig = { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:test@example.com' }
const FCM = 'https://fcm.googleapis.com/fcm/send/abc'
const APPLE = 'https://web.push.apple.com/xyz'
const KEYS = { p256dh: 'p', auth: 'a' }

/** Test session: the user id comes from the `x-user` header. */
const fakeSession: RequestHandler = (req, res, next) => {
  const id = req.get('x-user')
  if (!id) {
    res.status(401).end()
    return
  }
  res.locals.session = { user: { id, email: `${id}@example.com` } }
  next()
}

let t: TestDb
let app: express.Express
let clock: number
let sent: { endpoint: string; payload: unknown }[]
let failWith: Record<string, number>
let pending: Promise<unknown>[]
let sleeps: number[]
let relays: { url: string; init: RequestInit }[]
let wakers: (() => void)[]

beforeEach(async () => {
  wakers = []
  t = await createTestDb()
  clock = Date.parse('2026-11-23T10:00:00Z')
  sent = []
  failWith = {}
  pending = []
  sleeps = []
  relays = []
  const send: PushSender = async (sub, payload) => {
    const status = failWith[sub.endpoint]
    if (status) throw Object.assign(new Error('push failed'), { statusCode: status })
    sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) })
  }
  app = express()
  app.use(
    '/api/push',
    createPushRouter({
      getDb: () => t.db,
      requireSession: fakeSession,
      getVapid: () => VAPID,
      send,
      waitUntil: (p) => pending.push(p),
      // Time stands still until the test calls flush(), then jumps instead of waiting.
      sleep: async (ms) => {
        sleeps.push(ms)
        await new Promise<void>((resolve) => wakers.push(resolve))
        clock += ms
      },
      now: () => clock,
      fetch: (async (url: string, init: RequestInit) => {
        relays.push({ url, init })
        return new Response('{}', { status: 200 })
      }) as typeof fetch,
    }),
  )
})

afterEach(async () => {
  await t.close()
})

const flush = async () => {
  while (pending.length) {
    // Let the sleeping tasks reach their sleep, then wake them all.
    await new Promise((r) => setTimeout(r, 0))
    wakers.splice(0).forEach((wake) => wake())
    await pending.shift()
  }
}

async function subscribe(user: string, endpoint: string) {
  return request(app).post('/api/push/subscriptions').set('x-user', user).send({ endpoint, keys: KEYS })
}

describe('push router', () => {
  it('only accepts endpoints of the browser push services', () => {
    expect(isPushEndpoint(FCM)).toBe(true)
    expect(isPushEndpoint(APPLE)).toBe(true)
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true)
    expect(isPushEndpoint('http://fcm.googleapis.com/x')).toBe(false)
    expect(isPushEndpoint('https://evil.example/fcm.googleapis.com')).toBe(false)
    expect(isPushEndpoint('https://169.254.169.254/')).toBe(false)
  })

  it('serves the public key and requires a session', async () => {
    expect((await request(app).get('/api/push/key')).status).toBe(401)
    const res = await request(app).get('/api/push/key').set('x-user', 'u1')
    expect(res.body).toEqual({ publicKey: 'pub' })
  })

  it('stores a subscription, moves it to a new user, and deletes only your own', async () => {
    expect((await subscribe('u1', 'https://example.com/x')).status).toBe(400)
    expect((await subscribe('u1', FCM)).status).toBe(200)
    expect((await subscribe('u2', FCM)).status).toBe(200)
    let rows = await t.db.select().from(pushSubscriptions)
    expect(rows.map((r) => r.userId)).toEqual(['u2'])

    await request(app).delete('/api/push/subscriptions').set('x-user', 'u1').send({ endpoint: FCM })
    rows = await t.db.select().from(pushSubscriptions)
    expect(rows).toHaveLength(1)
    await request(app).delete('/api/push/subscriptions').set('x-user', 'u2').send({ endpoint: FCM })
    expect(await t.db.select().from(pushSubscriptions)).toHaveLength(0)
  })

  it('pushes the rest alert to every device after the grace period', async () => {
    await subscribe('u1', FCM)
    await subscribe('u1', APPLE)
    await subscribe('u2', 'https://fcm.googleapis.com/other')
    const at = clock + 90_000
    const res = await request(app)
      .post('/api/push/rest')
      .set('x-user', 'u1')
      .send({ id: 'r1', at, title: 'Descanso terminado', body: 'Pierna' })
    expect(res.status).toBe(200)
    await flush()
    expect(sleeps).toEqual([90_000 + GRACE_MS])
    expect(sent.map((s) => s.endpoint).sort()).toEqual([FCM, APPLE].sort())
    expect(sent[0]!.payload).toEqual({ type: 'rest-end', title: 'Descanso terminado', body: 'Pierna' })
    expect(await t.db.select().from(restAlerts)).toHaveLength(0)
  })

  it('sends nothing when the alert was cancelled or replaced', async () => {
    await subscribe('u1', FCM)
    const rest = (id: string) =>
      request(app).post('/api/push/rest').set('x-user', 'u1').send({ id, at: clock + 60_000, title: 't', body: 'b' })

    await rest('r1')
    await request(app).delete('/api/push/rest/r1').set('x-user', 'u1')
    await flush()
    expect(sent).toHaveLength(0)

    await rest('r2')
    await rest('r3')
    // A late cancel of the old rest leaves the new one alone.
    await request(app).delete('/api/push/rest/r2').set('x-user', 'u1')
    await flush()
    expect(sent).toHaveLength(1)
  })

  it('drops subscriptions the push service reports gone', async () => {
    await subscribe('u1', FCM)
    await subscribe('u1', APPLE)
    failWith[APPLE] = 410
    await request(app).post('/api/push/rest').set('x-user', 'u1').send({ id: 'r1', at: clock + 1000, title: 't', body: 'b' })
    await flush()
    const rows = await t.db.select().from(pushSubscriptions)
    expect(rows.map((r) => r.endpoint)).toEqual([FCM])
  })

  it('rejects invalid rests', async () => {
    const post = (body: object) => request(app).post('/api/push/rest').set('x-user', 'u1').send(body)
    expect((await post({ id: 'r', at: clock - 60_000, title: 't', body: 'b' })).status).toBe(400)
    expect((await post({ id: 'r', at: clock + 2 * 3600_000, title: 't', body: 'b' })).status).toBe(400)
    expect((await post({ id: 'bad id!', at: clock + 1000, title: 't', body: 'b' })).status).toBe(400)
    expect((await post({ id: 'r', at: clock + 1000, title: 'x'.repeat(500), body: 'b' })).status).toBe(400)
  })

  it('hands a long wait to a signed relay, which finishes the job', async () => {
    await subscribe('u1', FCM)
    await request(app)
      .post('/api/push/rest')
      .set('x-user', 'u1')
      .set('host', 'app.example')
      .set('x-forwarded-proto', 'https')
      .send({ id: 'r1', at: clock + 5 * 60_000, title: 't', body: 'b' })
    await flush()
    expect(sleeps).toEqual([MAX_WAIT_MS])
    expect(sent).toHaveLength(0)
    expect(relays).toHaveLength(1)
    expect(relays[0]!.url).toBe('https://app.example/api/push/relay')
    const headers = relays[0]!.init.headers as Record<string, string>
    expect(headers['x-push-relay']).toBe(relaySignature('priv', 'u1', 'r1'))

    // Forged relays are refused.
    const forged = await request(app)
      .post('/api/push/relay')
      .set('x-push-relay', 'nope')
      .send({ userId: 'u1', id: 'r1' })
    expect(forged.status).toBe(403)

    await request(app)
      .post('/api/push/relay')
      .set('x-push-relay', headers['x-push-relay']!)
      .send(JSON.parse(relays[0]!.init.body as string))
    await flush()
    expect(sleeps).toEqual([MAX_WAIT_MS, 5 * 60_000 + GRACE_MS - MAX_WAIT_MS])
    expect(sent).toHaveLength(1)
  })
})
