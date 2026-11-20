import 'fake-indexeddb/auto'
import type { PullRow, PushChange, PushOutcome } from '@training-log/contract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'
import { outboxKey, pendingEntries } from '../outbox'
import { createRoutine, updateRoutine } from '../repositories/routines'
import { DEFAULT_SETTINGS, saveSettings } from '../repositories/settings'
import { getMeta } from '../syncMeta'
import { TEST_USER, resetDb } from '../testUtils'
import { createSyncEngine, type SessionCheck } from './engine'
import { createSyncStatusStore, indicatorState, type SyncSnapshot } from './status'
import { startSyncTriggers } from './triggers'

const OTHER_USER_ID = '0190f0c0-0000-7000-8000-000000000002'

// ---------------------------------------------------------------------------
// A fake sync API with per-user versions, mirroring the U6 server.

type StoredRow = { table: string; row: Record<string, unknown> }

interface FakeServer {
  fetch: typeof fetch
  rows: Map<string, StoredRow>
  pushes: PushChange[][]
  pulls: number[]
  /** Forces an outcome for a row id. */
  outcomeFor: Map<string, { status: 'retryable' | 'rejected'; reason?: string }>
  /** Next push responds with this HTTP status instead of handling it. */
  pushHttp: number | null
  /** Throw a network error on every request while true. */
  down: boolean
  /** Rows per pull page. */
  pageSize: number
  /** Awaited inside push before responding (to edit while it is in flight). */
  beforePushResponse: (() => Promise<void>) | null
  seed(table: string, row: Record<string, unknown>): void
  requests(): number
}

function createFakeServer(): FakeServer {
  let counter = 0
  const server: FakeServer = {
    rows: new Map(),
    pushes: [],
    pulls: [],
    outcomeFor: new Map(),
    pushHttp: null,
    down: false,
    pageSize: 500,
    beforePushResponse: null,
    seed(table, row) {
      counter += 1
      server.rows.set(`${table}:${row.id as string}`, {
        table,
        row: { ...row, userId: TEST_USER.id, version: counter, updatedAt: new Date().toISOString() },
      })
    },
    requests: () => server.pushes.length + server.pulls.length,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (server.down) throw new TypeError('Failed to fetch')
      const url = new URL(String(input), 'http://app.test')
      expect(init?.credentials).toBe('include')
      if (url.pathname === '/api/sync/push' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { contractVersion: number; changes: PushChange[] }
        server.pushes.push(body.changes)
        if (server.pushHttp === 401) return json(401, { error: 'unauthorized' })
        if (server.pushHttp === 409) return json(409, { error: 'client_outdated' })
        if (server.beforePushResponse) await server.beforePushResponse()
        const outcomes: PushOutcome[] = body.changes.map((c) => {
          const forced = server.outcomeFor.get(c.row.id)
          const base = { table: c.table, id: c.row.id, rev: c.rev }
          if (forced) return { ...base, ...forced }
          counter += 1
          let key = `${c.table}:${c.row.id}`
          let id = c.row.id
          if (c.table === 'settings') {
            // One settings row per user: the server keeps its existing id.
            const existing = [...server.rows.values()].find((r) => r.table === 'settings')
            if (existing) {
              id = existing.row.id as string
              key = `settings:${id}`
            }
          }
          server.rows.set(key, {
            table: c.table,
            row: { ...c.row, id, userId: TEST_USER.id, version: counter, updatedAt: new Date().toISOString() },
          })
          return { ...base, status: 'accepted' }
        })
        return json(200, { outcomes })
      }
      if (url.pathname === '/api/sync/pull') {
        const cursor = Number(url.searchParams.get('cursor'))
        const limit = Math.min(Number(url.searchParams.get('limit') ?? 500), server.pageSize)
        server.pulls.push(cursor)
        const newer = [...server.rows.values()]
          .filter((r) => (r.row.version as number) > cursor)
          .sort((a, b) => (a.row.version as number) - (b.row.version as number))
        const page = newer.slice(0, limit)
        const last = page.at(-1)
        return json(200, {
          rows: page.map((r) => ({ table: r.table, row: { ...r.row } }) as unknown as PullRow),
          cursor: last ? (last.row.version as number) : cursor,
          hasMore: newer.length > page.length,
        })
      }
      return json(404, { error: 'not_found' })
    }) as typeof fetch,
  }
  return server
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// ---------------------------------------------------------------------------

interface Harness {
  server: FakeServer
  status: ReturnType<typeof createSyncStatusStore>
  engine: ReturnType<typeof createSyncEngine>
  online: { value: boolean }
  session: { value: SessionCheck }
  scheduled: { fn: () => void; ms: number }[]
}

function setup(): Harness {
  const server = createFakeServer()
  const status = createSyncStatusStore()
  const online = { value: true }
  const session: { value: SessionCheck } = { value: { kind: 'ok', userId: TEST_USER.id } }
  const scheduled: Harness['scheduled'] = []
  const engine = createSyncEngine({
    fetch: server.fetch,
    checkSession: async () => session.value,
    isOnline: () => online.value,
    status,
    schedule: (fn, ms) => {
      const entry = { fn, ms }
      scheduled.push(entry)
      return () => {
        const i = scheduled.indexOf(entry)
        if (i >= 0) scheduled.splice(i, 1)
      }
    },
  })
  return { server, status, engine, online, session, scheduled }
}

let h: Harness
const snap = (): SyncSnapshot => h.status.getSnapshot()

beforeEach(async () => {
  await resetDb()
  h = setup()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('sync engine', () => {
  it('Covers F2: offline writes wait with status offline; going online pushes them and reaches synced', async () => {
    h.online.value = false
    const stop = startSyncTriggers(h.engine, { debounceMs: 5, intervalMs: 60_000, isOnline: () => h.online.value })
    try {
      const r = await createRoutine({ name: 'Pierna' })
      await vi.waitFor(() => expect(snap()).toMatchObject({ status: 'offline', pendingCount: 1 }))
      expect(indicatorState(snap())).toEqual({ state: 'sin-conexion', pendingCount: 1, showReauthBanner: false })
      expect(h.server.requests()).toBe(0)

      h.online.value = true
      window.dispatchEvent(new Event('online'))
      await vi.waitFor(() => expect(snap()).toMatchObject({ status: 'synced', pendingCount: 0 }))
      expect(indicatorState(snap()).state).toBe('sincronizado')
      expect(h.server.rows.get(`routines:${r.id}`)?.row.name).toBe('Pierna')
      expect(await pendingEntries()).toEqual([])
      expect(snap().lastSyncedAt).not.toBeNull()
    } finally {
      stop()
    }
  })

  it('does not apply a pulled row over a local row with a pending outbox entry', async () => {
    const r = await createRoutine({ name: 'Local' })
    h.server.seed('routines', { ...(await db.routines.get(r.id))!, name: 'Servidor' })
    h.server.outcomeFor.set(r.id, { status: 'retryable' })

    expect(await h.engine.sync()).toBe('ok')

    expect((await db.routines.get(r.id))?.name).toBe('Local')
    expect(await db.outbox.get(outboxKey('routines', r.id))).toBeDefined()
    expect(snap().status).toBe('pending')
  })

  it('Covers AE5: a 401 during push sets authExpired, keeps the outbox, and logging still works', async () => {
    const r = await createRoutine({ name: 'Pierna' })
    h.server.pushHttp = 401

    expect(await h.engine.sync()).toBe('auth-expired')
    expect(snap().status).toBe('authExpired')
    expect(indicatorState(snap())).toMatchObject({ state: 'pendiente', showReauthBanner: true })
    expect((await pendingEntries()).map((e) => e.rowId)).toEqual([r.id])

    // Logging keeps working, and sync stays stopped until re-auth.
    const r2 = await createRoutine({ name: 'Torso' })
    expect((await pendingEntries()).map((e) => e.rowId)).toEqual([r.id, r2.id])
    const before = h.server.requests()
    expect(await h.engine.sync()).toBe('stopped')
    expect(h.server.requests()).toBe(before)

    // The same user enters the code again: everything syncs.
    h.server.pushHttp = null
    expect(await h.engine.resume()).toBe('ok')
    expect(snap().status).toBe('synced')
    expect(h.server.rows.get(`routines:${r2.id}`)?.row.name).toBe('Torso')
  })

  it('a network error leaves status pending and retries with exponential backoff', async () => {
    await createRoutine({ name: 'Pierna' })
    h.server.down = true

    expect(await h.engine.sync()).toBe('network-error')
    expect(snap().status).toBe('pending')
    expect(h.scheduled.map((s) => s.ms)).toEqual([2_000])

    h.scheduled.shift()!.fn()
    await vi.waitFor(() => expect(h.scheduled.map((s) => s.ms)).toEqual([4_000]))
    expect(snap().status).toBe('pending')

    for (let i = 0; i < 10; i++) {
      h.scheduled.shift()!.fn()
      await vi.waitFor(() => expect(h.scheduled).toHaveLength(1))
    }
    expect(h.scheduled[0]!.ms).toBe(300_000)

    h.server.down = false
    h.scheduled.shift()!.fn()
    await vi.waitFor(() => expect(snap().status).toBe('synced'))
    expect(h.scheduled).toEqual([])
  })

  it('two triggers firing together run one cycle', async () => {
    await createRoutine({ name: 'Pierna' })
    await Promise.all([h.engine.sync(), h.engine.sync()])
    expect(h.server.pushes).toHaveLength(1)
    expect(h.server.pulls).toHaveLength(1)
  })

  it('pages the pull; afterwards the cursor equals the last pulled version and a second cycle pulls nothing', async () => {
    h.server.pageSize = 2
    const base = { userId: TEST_USER.id, deletedAt: null, color: '#888888', folderId: null, notes: '', archived: false }
    const ids = ['0190f0c0-0000-7000-8000-00000000000a', '0190f0c0-0000-7000-8000-00000000000b', '0190f0c0-0000-7000-8000-00000000000c']
    ids.forEach((id, i) =>
      h.server.seed('routines', { ...base, id, name: `R${i}`, order: i, createdAt: '2026-11-01T10:00:00.000Z' }),
    )

    await h.engine.sync()
    expect(await getMeta('cursor')).toBe(3)
    expect((await db.routines.toArray()).map((r) => r.name).sort()).toEqual(['R0', 'R1', 'R2'])
    expect(h.server.pulls).toEqual([0, 2])
    // Applying pulled rows never creates outbox entries.
    expect(await pendingEntries()).toEqual([])

    await h.engine.sync()
    expect(h.server.pulls).toEqual([0, 2, 3])
    expect(await getMeta('cursor')).toBe(3)
  })

  it('keeps an edit made while its push is in flight and sends it in the next cycle', async () => {
    const r = await createRoutine({ name: 'A' })
    h.server.beforePushResponse = async () => {
      h.server.beforePushResponse = null
      await updateRoutine(r.id, { name: 'B' })
    }

    await h.engine.sync()
    expect((await db.routines.get(r.id))?.name).toBe('B')
    const [entry] = await pendingEntries()
    expect(entry).toMatchObject({ rowId: r.id, rev: 2 })
    expect(h.server.rows.get(`routines:${r.id}`)?.row.name).toBe('A')

    await h.engine.sync()
    expect(h.server.rows.get(`routines:${r.id}`)?.row.name).toBe('B')
    expect(await pendingEntries()).toEqual([])
    expect(snap().status).toBe('synced')
  })

  it('moves a rejected change to syncErrors and still reaches synced', async () => {
    const r = await createRoutine({ name: 'Pierna' })
    h.server.outcomeFor.set(r.id, { status: 'rejected', reason: 'foreign_id' })

    await h.engine.sync()
    expect(await pendingEntries()).toEqual([])
    const errors = await db.syncErrors.toArray()
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ key: `routines:${r.id}`, table: 'routines', rowId: r.id, reason: 'foreign_id' })
    expect(snap()).toMatchObject({ status: 'synced', errorCount: 1 })
  })

  it('a client_outdated response stops syncing, keeps the outbox and raises the update flag', async () => {
    const r = await createRoutine({ name: 'Pierna' })
    h.server.pushHttp = 409

    expect(await h.engine.sync()).toBe('client-outdated')
    expect(snap().updateAvailableRequired).toBe(true)
    expect((await pendingEntries()).map((e) => e.rowId)).toEqual([r.id])

    h.server.pushHttp = null
    const before = h.server.requests()
    expect(await h.engine.sync()).toBe('stopped')
    expect(h.server.requests()).toBe(before)
  })

  it('replaces the local settings row when the server returns settings under a different id', async () => {
    const local = await saveSettings({ displayName: 'Ana' })
    await db.outbox.clear() // already pushed earlier
    const serverId = '0190f0c0-0000-7000-8000-0000000000ff'
    h.server.seed('settings', { ...DEFAULT_SETTINGS, id: serverId, displayName: 'Ana servidor', deletedAt: null })

    await h.engine.sync()
    const rows = await db.settings.toArray()
    expect(rows.map((s) => [s.id, s.displayName])).toEqual([[serverId, 'Ana servidor']])
    expect(rows[0]!.id).not.toBe(local.id)
  })

  it('keeps a pending local settings row and converges on the next cycle', async () => {
    const serverId = '0190f0c0-0000-7000-8000-0000000000ff'
    h.server.seed('settings', { ...DEFAULT_SETTINGS, id: serverId, displayName: 'Viejo', deletedAt: null })
    const local = await saveSettings({ displayName: 'Nuevo' })
    h.server.outcomeFor.set(local.id, { status: 'retryable' })

    await h.engine.sync()
    expect((await db.settings.toArray()).map((s) => [s.id, s.displayName])).toEqual([[local.id, 'Nuevo']])

    h.server.outcomeFor.delete(local.id)
    await h.engine.sync()
    expect((await db.settings.toArray()).map((s) => [s.id, s.displayName])).toEqual([[serverId, 'Nuevo']])
    expect(await pendingEntries()).toEqual([])
  })

  it('stops the cycle when the session belongs to a different user: nothing pushed, nothing pulled', async () => {
    const r = await createRoutine({ name: 'Pierna' })
    h.server.seed('folders', { id: '0190f0c0-0000-7000-8000-0000000000aa', name: 'Ajena', order: 0, isCycle: false, deletedAt: null })
    h.session.value = { kind: 'ok', userId: OTHER_USER_ID }

    expect(await h.engine.sync()).toBe('user-mismatch')
    expect(h.server.requests()).toBe(0)
    expect(await db.folders.count()).toBe(0)
    expect((await pendingEntries()).map((e) => e.rowId)).toEqual([r.id])
    expect(await getMeta('cursor')).toBe(0)
  })
})

describe('indicatorState', () => {
  const base: SyncSnapshot = {
    status: 'synced',
    pendingCount: 0,
    errorCount: 0,
    lastSyncedAt: null,
    updateAvailableRequired: false,
  }

  it('maps each status to the three R6 states', () => {
    expect(indicatorState(base)).toEqual({ state: 'sincronizado', pendingCount: 0, showReauthBanner: false })
    expect(indicatorState({ ...base, status: 'pending', pendingCount: 2 }).state).toBe('pendiente')
    expect(indicatorState({ ...base, status: 'syncing', pendingCount: 2 }).state).toBe('pendiente')
    expect(indicatorState({ ...base, status: 'offline', pendingCount: 3 })).toEqual({
      state: 'sin-conexion',
      pendingCount: 3,
      showReauthBanner: false,
    })
    expect(indicatorState({ ...base, status: 'authExpired', pendingCount: 1 })).toEqual({
      state: 'pendiente',
      pendingCount: 1,
      showReauthBanner: true,
    })
  })
})
