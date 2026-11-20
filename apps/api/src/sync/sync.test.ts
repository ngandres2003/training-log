import { CONTRACT_VERSION, type PullResponse, type PushResponse } from '@training-log/contract'
import { eq } from 'drizzle-orm'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { createAuth } from '../auth/auth.js'
import { signInForTest, TEST_BASE_URL, TEST_SECRET } from '../auth/test-helpers.js'
import { folders, routines, settings, syncCounters, workoutExercises } from '../db/schema.js'
import { createTestDb, type TestDb } from '../db/test-db.js'

const BASE_URL = TEST_BASE_URL
const SECRET = TEST_SECRET

let t: TestDb
let app: ReturnType<typeof createApp>

beforeEach(async () => {
  t = await createTestDb()
  app = createApp({ auth: createAuth({ db: t.db, secret: SECRET, baseURL: BASE_URL }), db: t.db })
})

afterEach(async () => {
  await t.close()
})

interface Account {
  id: string
  cookie: string
}

function signIn(email: string): Promise<Account> {
  return signInForTest(app, t.db, email)
}

let seq = 0
/** A fresh UUIDv7-shaped id. */
function uuid(): string {
  seq += 1
  return `0190f5a2-7b1c-7d3e-8f00-${seq.toString(16).padStart(12, '0')}`
}

const NOW = '2026-11-19T10:00:00.000Z'

function routine(id: string, patch: Record<string, unknown> = {}) {
  return {
    id,
    userId: 'client-claims-this',
    updatedAt: NOW,
    deletedAt: null,
    version: 0,
    name: 'Push',
    color: '#ff0000',
    folderId: null,
    notes: '',
    order: 0,
    archived: false,
    createdAt: NOW,
    ...patch,
  }
}

function folder(id: string, patch: Record<string, unknown> = {}) {
  return { id, deletedAt: null, name: 'Carpeta', order: 0, isCycle: false, ...patch }
}

function settingsRow(id: string, patch: Record<string, unknown> = {}) {
  return {
    id,
    deletedAt: null,
    displayName: 'Ana',
    unit: 'kg',
    weeklyGoal: 3,
    weekStart: 'monday',
    theme: 'dark',
    preloadPrevious: true,
    soundOn: true,
    vibrationOn: true,
    keepScreenOn: true,
    onboardedAt: null,
    ...patch,
  }
}

function workoutExercise(id: string, patch: Record<string, unknown> = {}) {
  return {
    id,
    deletedAt: null,
    workoutId: uuid(),
    exerciseId: 'barbell-squat',
    routineExerciseId: null,
    order: 0,
    restSec: 90,
    note: '',
    supersetGroup: null,
    ...patch,
  }
}

type Change = { table: string; rev: number; row: unknown }

function push(account: Account, changes: Change[], body: Record<string, unknown> = { contractVersion: CONTRACT_VERSION }) {
  return request(app).post('/api/sync/push').set('Cookie', account.cookie).send({ ...body, changes })
}

async function pushOk(account: Account, changes: Change[]): Promise<PushResponse> {
  const res = await push(account, changes)
  expect(res.status).toBe(200)
  return res.body as PushResponse
}

async function pull(account: Account, cursor = 0, limit?: number): Promise<PullResponse> {
  const query: Record<string, number> = { cursor }
  if (limit !== undefined) query.limit = limit
  const res = await request(app).get('/api/sync/pull').query(query).set('Cookie', account.cookie)
  expect(res.status).toBe(200)
  return res.body as PullResponse
}

describe('sync API', () => {
  it('requires a session for push and pull', async () => {
    expect((await request(app).post('/api/sync/push').send({ contractVersion: CONTRACT_VERSION, changes: [] })).status).toBe(401)
    expect((await request(app).get('/api/sync/pull')).status).toBe(401)
  })

  it('returns a pushed routine with a version on a pull from cursor 0', async () => {
    const ana = await signIn('ana@example.com')
    const id = uuid()
    const res = await pushOk(ana, [{ table: 'routines', rev: 1, row: routine(id) }])
    expect(res.outcomes).toEqual([{ table: 'routines', id, rev: 1, status: 'accepted' }])

    const page = await pull(ana)
    expect(page.hasMore).toBe(false)
    expect(page.rows).toHaveLength(1)
    const { table, row } = page.rows[0]!
    expect(table).toBe('routines')
    const { updatedAt: _clientTime, ...content } = routine(id)
    expect(row).toMatchObject({ ...content, userId: ana.id, version: 1 })
    expect(page.cursor).toBe(1)
    // Server time, as an ISO string.
    expect(Date.parse(row.updatedAt)).toBeGreaterThan(Date.parse(NOW))
    expect(row.updatedAt).toMatch(/Z$/)
  })

  it('treats the same change pushed twice as harmless: one row, latest content', async () => {
    const ana = await signIn('ana@example.com')
    const id = uuid()
    await pushOk(ana, [{ table: 'routines', rev: 1, row: routine(id, { name: 'A' }) }])
    await pushOk(ana, [{ table: 'routines', rev: 1, row: routine(id, { name: 'A' }) }])
    const stored = await t.db.select().from(routines)
    expect(stored).toHaveLength(1)
    expect(stored[0]!.name).toBe('A')
    const page = await pull(ana)
    expect(page.rows).toHaveLength(1)
    expect(page.rows[0]!.row.version).toBe(2)
  })

  it('lets the later of two device pushes to the same row win (R7)', async () => {
    const ana = await signIn('ana@example.com')
    const id = uuid()
    await pushOk(ana, [{ table: 'routines', rev: 1, row: routine(id, { name: 'Phone' }) }])
    await pushOk(ana, [{ table: 'routines', rev: 4, row: routine(id, { name: 'Laptop' }) }])
    const page = await pull(ana)
    expect(page.rows.map((r) => r.row)).toEqual([expect.objectContaining({ id, name: 'Laptop' })])
  })

  it('stores a row under the session user even when the body claims another userId', async () => {
    const ana = await signIn('ana@example.com')
    const bea = await signIn('bea@example.com')
    const id = uuid()
    await pushOk(ana, [{ table: 'routines', rev: 1, row: routine(id, { userId: bea.id }) }])
    const [stored] = await t.db.select().from(routines).where(eq(routines.id, id))
    expect(stored!.userId).toBe(ana.id)
    expect((await pull(bea)).rows).toEqual([])
  })

  it("rejects a push to a row id owned by another user and leaves that user's row unchanged", async () => {
    const ana = await signIn('ana@example.com')
    const bea = await signIn('bea@example.com')
    const id = uuid()
    await pushOk(bea, [{ table: 'routines', rev: 1, row: routine(id, { name: 'Bea' }) }])
    const res = await pushOk(ana, [{ table: 'routines', rev: 1, row: routine(id, { name: 'Ana' }) }])
    expect(res.outcomes).toEqual([{ table: 'routines', id, rev: 1, status: 'rejected', reason: 'foreign_id' }])
    const stored = await t.db.select().from(routines)
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ userId: bea.id, name: 'Bea', version: 1 })
    expect((await pull(ana)).rows).toEqual([])
  })

  it("never includes another user's rows in a pull", async () => {
    const ana = await signIn('ana@example.com')
    const bea = await signIn('bea@example.com')
    const anaId = uuid()
    await pushOk(ana, [{ table: 'routines', rev: 1, row: routine(anaId) }])
    await pushOk(bea, [
      { table: 'routines', rev: 1, row: routine(uuid()) },
      { table: 'folders', rev: 1, row: folder(uuid()) },
    ])
    const page = await pull(ana)
    expect(page.rows.map((r) => r.row.id)).toEqual([anaId])
  })

  it('returns a tombstoned row from pull with deletedAt set', async () => {
    const ana = await signIn('ana@example.com')
    const id = uuid()
    await pushOk(ana, [{ table: 'folders', rev: 1, row: folder(id) }])
    const deletedAt = '2026-11-19T12:30:00.000Z'
    await pushOk(ana, [{ table: 'folders', rev: 2, row: folder(id, { deletedAt }) }])
    const page = await pull(ana, 1)
    expect(page.rows).toEqual([{ table: 'folders', row: expect.objectContaining({ id, deletedAt, version: 2 }) }])
  })

  it('pages 1,200 changed rows over three pulls without gaps or duplicates', async () => {
    const ana = await signIn('ana@example.com')
    const ids = new Set<string>()
    for (let batch = 0; batch < 3; batch++) {
      const changes: Change[] = []
      for (let i = 0; i < 400; i++) {
        const id = uuid()
        ids.add(id)
        // Spread over two tables so pages merge across tables.
        changes.push(i % 2 ? { table: 'folders', rev: 1, row: folder(id) } : { table: 'routines', rev: 1, row: routine(id) })
      }
      await pushOk(ana, changes)
    }

    const first = await pull(ana, 0)
    const second = await pull(ana, first.cursor)
    const third = await pull(ana, second.cursor)
    expect([first.rows.length, second.rows.length, third.rows.length]).toEqual([500, 500, 200])
    expect([first.hasMore, second.hasMore, third.hasMore]).toEqual([true, true, false])
    expect([first.cursor, second.cursor, third.cursor]).toEqual([500, 1000, 1200])
    const versions = [...first.rows, ...second.rows, ...third.rows].map((r) => r.row.version)
    expect(versions).toEqual(Array.from({ length: 1200 }, (_, i) => i + 1))
    const pulledIds = [...first.rows, ...second.rows, ...third.rows].map((r) => r.row.id)
    expect(new Set(pulledIds)).toEqual(ids)
  })

  it('rejects a malformed change with a reason and accepts the valid ones in the same batch', async () => {
    const ana = await signIn('ana@example.com')
    const good = uuid()
    const bad = uuid()
    const res = await pushOk(ana, [
      { table: 'folders', rev: 1, row: folder(good) },
      { table: 'folders', rev: 2, row: folder(bad, { order: 'first' }) },
      { table: 'personalRecords', rev: 3, row: folder(uuid()) },
    ])
    expect(res.outcomes).toEqual([
      { table: 'folders', id: good, rev: 1, status: 'accepted' },
      { table: 'folders', id: bad, rev: 2, status: 'rejected', reason: 'invalid:row.order' },
      { table: 'personalRecords', id: expect.any(String), rev: 3, status: 'rejected', reason: 'invalid:table' },
    ])
    expect((await t.db.select().from(folders)).map((f) => f.id)).toEqual([good])
  })

  it('answers client_outdated with 409 to an outdated contract version and stores nothing', async () => {
    const ana = await signIn('ana@example.com')
    for (const body of [{ contractVersion: 0 }, { contractVersion: 1 }, {}]) {
      const res = await push(ana, [{ table: 'folders', rev: 1, row: folder(uuid()) }], body)
      expect(res.status).toBe(409)
      expect(res.body).toEqual({ error: 'client_outdated' })
    }
    expect(await t.db.select().from(folders)).toEqual([])
    expect(await t.db.select().from(syncCounters)).toEqual([])
  })

  it('stores and returns the rest of a workout exercise, null meaning no rest', async () => {
    const ana = await signIn('ana@example.com')
    const withRest = uuid()
    const noRest = uuid()
    const res = await pushOk(ana, [
      { table: 'workoutExercises', rev: 1, row: workoutExercise(withRest, { restSec: 105 }) },
      { table: 'workoutExercises', rev: 1, row: workoutExercise(noRest, { restSec: null }) },
    ])
    expect(res.outcomes.map((o) => o.status)).toEqual(['accepted', 'accepted'])
    const stored = await t.db.select().from(workoutExercises)
    expect(Object.fromEntries(stored.map((r) => [r.id, r.restSec]))).toEqual({ [withRest]: 105, [noRest]: null })
    const rows = (await pull(ana)).rows.map((r) => r.row as { id: string; restSec: number | null })
    expect(Object.fromEntries(rows.map((r) => [r.id, r.restSec]))).toEqual({ [withRest]: 105, [noRest]: null })
  })

  it('rejects a workout exercise pushed without restSec', async () => {
    const ana = await signIn('ana@example.com')
    const { restSec: _r, ...row } = workoutExercise(uuid())
    const res = await pushOk(ana, [{ table: 'workoutExercises', rev: 1, row }])
    expect(res.outcomes[0]).toMatchObject({ status: 'rejected', reason: 'invalid:row.restSec' })
  })

  it('does not return a global default rest in settings', async () => {
    const ana = await signIn('ana@example.com')
    await pushOk(ana, [{ table: 'settings', rev: 1, row: settingsRow(uuid()) }])
    const { row } = (await pull(ana)).rows[0]!
    expect(row).not.toHaveProperty('defaultRestSec')
  })

  it('refuses a push of more than 500 changes', async () => {
    const ana = await signIn('ana@example.com')
    const changes = Array.from({ length: 501 }, () => ({ table: 'folders', rev: 1, row: folder(uuid()) }))
    const res = await push(ana, changes)
    expect(res.status).toBe(413)
    expect(await t.db.select().from(folders)).toEqual([])
  })

  it('converges settings created offline on two devices into the one row per user', async () => {
    const ana = await signIn('ana@example.com')
    const phone = uuid()
    const laptop = uuid()
    await pushOk(ana, [{ table: 'settings', rev: 1, row: settingsRow(phone, { weeklyGoal: 3 }) }])
    const res = await pushOk(ana, [{ table: 'settings', rev: 1, row: settingsRow(laptop, { weeklyGoal: 5 }) }])
    expect(res.outcomes).toEqual([{ table: 'settings', id: laptop, rev: 1, status: 'accepted' }])

    const stored = await t.db.select().from(settings)
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ id: phone, userId: ana.id, weeklyGoal: 5, version: 2 })
    const page = await pull(ana)
    expect(page.rows).toEqual([{ table: 'settings', row: expect.objectContaining({ id: phone, weeklyGoal: 5 }) }])
  })

  it("rejects a settings row whose id belongs to another user's settings", async () => {
    const ana = await signIn('ana@example.com')
    const bea = await signIn('bea@example.com')
    const id = uuid()
    await pushOk(bea, [{ table: 'settings', rev: 1, row: settingsRow(id, { displayName: 'Bea' }) }])
    const res = await pushOk(ana, [{ table: 'settings', rev: 1, row: settingsRow(id, { displayName: 'Ana' }) }])
    expect(res.outcomes[0]).toMatchObject({ status: 'rejected', reason: 'foreign_id' })
    expect(await t.db.select().from(settings)).toEqual([expect.objectContaining({ userId: bea.id, displayName: 'Bea' })])
  })

  it('never lets a pull taken during two concurrent pushes skip a version, and a later pull returns every row', async () => {
    const ana = await signIn('ana@example.com')
    const a = Array.from({ length: 50 }, () => uuid())
    const b = Array.from({ length: 50 }, () => uuid())
    const toChanges = (ids: string[]): Change[] => ids.map((id) => ({ table: 'routines', rev: 1, row: routine(id) }))

    // Pushes and pulls race; each pull must see a gap-free prefix of versions.
    const pulls: Promise<PullResponse>[] = []
    const pushes = [pushOk(ana, toChanges(a)), pushOk(ana, toChanges(b))]
    for (let i = 0; i < 4; i++) pulls.push(pull(ana))
    const [pa, pb] = await Promise.all(pushes)
    const midway = await Promise.all(pulls)

    expect([...pa!.outcomes, ...pb!.outcomes].every((o) => o.status === 'accepted')).toBe(true)

    // Each push got one contiguous range from the counter, so the two never interleave.
    const all = await pull(ana)
    expect(all.hasMore).toBe(false)
    expect(all.rows).toHaveLength(100)
    const versionOf = new Map(all.rows.map((r) => [r.row.id, r.row.version]))
    const range = (ids: string[]) => ids.map((id) => versionOf.get(id)!)
    const [ra, rb] = [range(a), range(b)]
    const contiguous = (vs: number[]) => vs.every((v, i) => i === 0 || v === vs[i - 1]! + 1)
    expect(contiguous(ra) && contiguous(rb)).toBe(true)
    expect(Math.max(...ra) < Math.min(...rb) || Math.max(...rb) < Math.min(...ra)).toBe(true)

    for (const page of midway) {
      const seen = page.rows.map((r) => r.row.version)
      expect(seen).toEqual(Array.from({ length: page.cursor }, (_, i) => i + 1))
      const rest = await pull(ana, page.cursor)
      expect([...seen, ...rest.rows.map((r) => r.row.version)]).toEqual(Array.from({ length: 100 }, (_, i) => i + 1))
    }
  })
})
