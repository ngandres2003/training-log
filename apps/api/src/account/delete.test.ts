import { eq } from 'drizzle-orm'
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { createAuth } from '../auth/auth.js'
import { createTestMailer, type TestMailer } from '../auth/mailer.js'
import { requireSession } from '../auth/require-session.js'
import { user } from '../db/auth-schema.js'
import { syncTables } from '../db/queries.js'
import { syncCounters } from '../db/schema.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import type { BlobClient } from './delete.js'
import { createAccountRouter } from './router.js'

const BASE_URL = 'http://localhost:3000'
const SECRET = 'test-secret-0123456789-abcdefghijklmnop'
const NOW = '2026-11-19T10:00:00.000Z'

/** In-memory Blob store; `list` pages two at a time so pagination is exercised. */
function createFakeBlob(pathnames: string[]): BlobClient & { pathnames: Set<string> } {
  const store = new Set(pathnames)
  const urlOf = (p: string) => `https://blob.example/${p}`
  return {
    pathnames: store,
    async list({ prefix, cursor }) {
      const all = [...store].filter((p) => p.startsWith(prefix)).sort()
      const start = cursor ? Number(cursor) : 0
      const page = all.slice(start, start + 2)
      const hasMore = start + 2 < all.length
      return {
        blobs: page.map((p) => ({ pathname: p, url: urlOf(p) })),
        hasMore,
        cursor: hasMore ? String(start + 2) : undefined,
      }
    },
    async del(urls) {
      for (const u of urls) store.delete(u.replace('https://blob.example/', ''))
    },
  }
}

let t: TestDb
let mailer: TestMailer
let app: express.Express
let blob: ReturnType<typeof createFakeBlob>

interface Device {
  id: string
  cookie: string
}

async function signIn(email: string): Promise<Device> {
  await request(app)
    .post('/api/auth/email-otp/send-verification-otp')
    .set('Origin', BASE_URL)
    .send({ email, type: 'sign-in' })
  const res = await request(app)
    .post('/api/auth/sign-in/email-otp')
    .set('Origin', BASE_URL)
    .send({ email, otp: mailer.lastCodeFor(email) })
  expect(res.status).toBe(200)
  const raw = res.headers['set-cookie'] as unknown as string[]
  const cookie = raw.map((c) => c.split(';')[0]).join('; ')
  const me = await request(app).get('/api/me').set('Cookie', cookie)
  return { id: me.body.user.id as string, cookie }
}

let seq = 0
function uuid(): string {
  seq += 1
  return `0190f5a2-7b1c-7d3e-8f00-${seq.toString(16).padStart(12, '0')}`
}

function rows() {
  const folderId = uuid()
  const routineId = uuid()
  return [
    {
      table: 'folders',
      rev: 1,
      row: { id: folderId, deletedAt: null, name: 'Fuerza', order: 0, isCycle: false },
    },
    {
      table: 'routines',
      rev: 1,
      row: {
        id: routineId,
        deletedAt: null,
        name: 'Push',
        color: '#ff0000',
        folderId,
        notes: '',
        order: 0,
        archived: false,
        createdAt: NOW,
      },
    },
    {
      table: 'settings',
      rev: 1,
      row: {
        id: uuid(),
        deletedAt: null,
        displayName: 'X',
        unit: 'kg',
        weeklyGoal: 3,
        defaultRestSec: 90,
        weekStart: 'monday',
        theme: 'dark',
        preloadPrevious: true,
        soundOn: true,
        vibrationOn: true,
        keepScreenOn: true,
        onboardedAt: null,
      },
    },
  ]
}

function push(device: Device) {
  return request(app)
    .post('/api/sync/push')
    .set('Cookie', device.cookie)
    .send({ contractVersion: 1, changes: rows() })
}

async function countRows(userId: string): Promise<number> {
  let n = 0
  for (const pg of Object.values(syncTables)) {
    n += (
      await t.db
        .select()
        .from(pg as typeof syncTables.folders)
        .where(eq(pg.userId, userId))
    ).length
  }
  n += (await t.db.select().from(syncCounters).where(eq(syncCounters.userId, userId))).length
  return n
}

beforeEach(async () => {
  t = await createTestDb()
  mailer = createTestMailer()
  const auth = createAuth({ db: t.db, mailer, secret: SECRET, baseURL: BASE_URL })
  blob = createFakeBlob([])
  app = express()
  app.use(
    '/api/account',
    createAccountRouter({
      getDb: () => t.db,
      getAuth: () => auth,
      requireSession: requireSession(() => auth),
      blobToken: 'test-token',
      blob,
    }),
  )
  app.use(createApp({ auth, db: t.db }))
})

afterEach(async () => {
  await t.close()
})

describe('DELETE /api/account', () => {
  it('requires a session', async () => {
    expect((await request(app).delete('/api/account')).status).toBe(401)
  })

  it("deletes the user's rows and photos, revokes other sessions and keeps the account", async () => {
    const phone = await signIn('ana@example.com')
    const laptop = await signIn('ana@example.com')
    const bea = await signIn('bea@example.com')
    expect(laptop.id).toBe(phone.id)
    expect((await push(phone)).status).toBe(200)
    expect((await push(bea)).status).toBe(200)
    for (const p of [
      `custom-exercises/${phone.id}/a.webp`,
      `custom-exercises/${phone.id}/b.webp`,
      `custom-exercises/${phone.id}/c.jpg`,
      `custom-exercises/${bea.id}/d.webp`,
    ]) {
      blob.pathnames.add(p)
    }
    expect(await countRows(phone.id)).toBe(4)

    const res = await request(app).delete('/api/account').set('Cookie', phone.cookie)
    expect(res.status).toBe(200)

    // Ana's server data and photos are gone; Bea's are intact.
    expect(await countRows(phone.id)).toBe(0)
    expect(await countRows(bea.id)).toBe(4)
    expect([...blob.pathnames]).toEqual([`custom-exercises/${bea.id}/d.webp`])

    // The other device is signed out; the requesting one stays signed in with the same account.
    expect((await push(laptop)).status).toBe(401)
    const me = await request(app).get('/api/me').set('Cookie', phone.cookie)
    expect(me.status).toBe(200)
    expect(me.body.user.id).toBe(phone.id)
    expect(await t.db.select().from(user).where(eq(user.id, phone.id))).toHaveLength(1)
    // Bea is unaffected.
    expect((await request(app).get('/api/me').set('Cookie', bea.cookie)).status).toBe(200)
  })
})
