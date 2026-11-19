import {
  CONTRACT_VERSION,
  MAX_PULL_LIMIT,
  MAX_PUSH_CHANGES,
  type PullResponse,
  type PushChange,
  type PushRequest,
  type PushResponse,
} from '@training-log/contract'
import { SYNC_TABLES, type SyncTable } from '@training-log/domain'
import { authClient, ensureSameUser } from '../../features/auth/auth-client'
import { db, syncTable, type OutboxEntry } from '../db'
import { nowIso } from '../ids'
import { clearIfRevMatches, outboxKey, pendingEntries } from '../outbox'
import { getMeta, setMeta } from '../syncMeta'
import { syncStatus, type SyncStatusStore } from './status'

/** Result of the session check that opens every online cycle (U7 step 5). */
export type SessionCheck = { kind: 'ok'; userId: string } | { kind: 'none' } | { kind: 'network' }

export type CycleResult =
  | 'ok'
  | 'offline'
  | 'network-error'
  | 'auth-expired'
  | 'user-mismatch'
  | 'client-outdated'
  /** Sync is stopped (auth expired or client outdated) until `resume()` or a reload. */
  | 'stopped'

export interface SyncEngineDeps {
  fetch?: typeof fetch
  checkSession?: () => Promise<SessionCheck>
  isOnline?: () => boolean
  status?: SyncStatusStore
  /** Runs `fn` after `ms`; returns a cancel function. */
  schedule?: (fn: () => void, ms: number) => () => void
}

export interface SyncEngine {
  /** Runs one push-then-pull cycle; joins the cycle already in flight. */
  sync(): Promise<CycleResult>
  /** Clears a stop (after the same user re-enters the code) and runs a cycle. */
  resume(): Promise<CycleResult>
  /** Re-reads pending/error counts and last sync time into the status store. */
  refreshCounts(): Promise<void>
  isRunning(): boolean
  readonly status: SyncStatusStore
}

export const BACKOFF_BASE_MS = 2_000
export const BACKOFF_MAX_MS = 5 * 60_000

/** Session check through Better Auth; `get-session` also slides the cookie (KTD3). */
export async function checkSessionWithAuthClient(): Promise<SessionCheck> {
  try {
    const { data, error } = await authClient.getSession()
    if (error) return error.status === 401 ? { kind: 'none' } : { kind: 'network' }
    return data?.user ? { kind: 'ok', userId: data.user.id } : { kind: 'none' }
  } catch {
    return { kind: 'network' }
  }
}

class HttpStop extends Error {
  constructor(readonly result: 'auth-expired' | 'client-outdated') {
    super(result)
  }
}
class NetworkFailure extends Error {}

export function createSyncEngine(deps: SyncEngineDeps = {}): SyncEngine {
  const doFetch = deps.fetch ?? ((input, init) => globalThis.fetch(input, init))
  const checkSession = deps.checkSession ?? checkSessionWithAuthClient
  const isOnline = deps.isOnline ?? (() => navigator.onLine)
  const status = deps.status ?? syncStatus
  const schedule =
    deps.schedule ??
    ((fn, ms) => {
      const id = setTimeout(fn, ms)
      return () => clearTimeout(id)
    })

  let inFlight: Promise<CycleResult> | null = null
  let stopped: 'auth-expired' | 'client-outdated' | null = null
  let failures = 0
  let cancelRetry: (() => void) | null = null

  async function refreshCounts() {
    const [pendingCount, errorCount, lastSyncedAt] = await Promise.all([
      db.outbox.count(),
      db.syncErrors.count(),
      getMeta('lastSyncedAt'),
    ])
    status.update({ pendingCount, errorCount, lastSyncedAt })
  }

  async function request(path: string, init: RequestInit): Promise<Response> {
    let res: Response
    try {
      res = await doFetch(path, { ...init, credentials: 'include' })
    } catch {
      throw new NetworkFailure()
    }
    if (res.status === 401) throw new HttpStop('auth-expired')
    if (res.status === 409) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      if (body?.error === 'client_outdated') throw new HttpStop('client-outdated')
    }
    if (!res.ok) throw new NetworkFailure()
    return res
  }

  async function push() {
    const entries = await pendingEntries()
    for (let i = 0; i < entries.length; i += MAX_PUSH_CHANGES) {
      const batch = entries.slice(i, i + MAX_PUSH_CHANGES)
      const body: PushRequest = {
        contractVersion: CONTRACT_VERSION,
        changes: batch.map((e) => ({ table: e.table, rev: e.rev, row: e.row }) as PushChange),
      }
      const res = await request('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const { outcomes } = (await res.json()) as PushResponse
      for (const [j, entry] of batch.entries()) {
        const outcome = outcomes[j]
        if (!outcome) continue
        if (outcome.status === 'accepted') await clearIfRevMatches(entry.key, entry.rev)
        else if (outcome.status === 'rejected') await moveToErrors(entry, outcome.reason ?? 'rejected')
      }
    }
  }

  async function pull() {
    for (;;) {
      const cursor = await getMeta('cursor')
      const res = await request(`/api/sync/pull?cursor=${cursor}&limit=${MAX_PULL_LIMIT}`, { method: 'GET' })
      const page = (await res.json()) as PullResponse
      await applyPulled(page)
      if (!page.hasMore) return
    }
  }

  async function runCycle(): Promise<CycleResult> {
    if (stopped) return 'stopped'
    const online = isOnline()
    status.update({ online })
    if (!online) {
      await refreshCounts()
      return 'offline'
    }
    cancelRetry?.()
    cancelRetry = null
    status.update({ syncing: true })
    try {
      const session = await checkSession()
      if (session.kind === 'network') throw new NetworkFailure()
      if (session.kind === 'none') throw new HttpStop('auth-expired')
      if (!(await ensureSameUser(session.userId))) {
        // Another account's session must never receive or overwrite this device's data (U3 step 7).
        stopped = 'auth-expired'
        status.update({ authExpired: true })
        return 'user-mismatch'
      }
      await push()
      await pull()
      await setMeta('lastSyncedAt', nowIso())
      failures = 0
      return 'ok'
    } catch (err) {
      if (err instanceof HttpStop) {
        stopped = err.result
        status.update(err.result === 'auth-expired' ? { authExpired: true } : { updateAvailableRequired: true })
        return err.result
      }
      if (!(err instanceof NetworkFailure)) throw err
      failures += 1
      const delay = Math.min(BACKOFF_BASE_MS * 2 ** (failures - 1), BACKOFF_MAX_MS)
      cancelRetry = schedule(() => {
        cancelRetry = null
        void sync()
      }, delay)
      status.update({ online: isOnline() })
      return 'network-error'
    } finally {
      await refreshCounts()
      status.update({ syncing: false })
    }
  }

  function sync(): Promise<CycleResult> {
    inFlight ??= runCycle().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  return {
    sync,
    resume() {
      stopped = null
      status.update({ authExpired: false })
      return sync()
    },
    refreshCounts,
    isRunning: () => inFlight !== null,
    status,
  }
}

/** Rejected changes leave the outbox (if not edited since) and go to `syncErrors` (KTD5 step 3). */
async function moveToErrors(entry: OutboxEntry, reason: string) {
  await db.transaction('rw', db.outbox, db.syncErrors, async () => {
    await db.syncErrors.put({
      key: entry.key,
      table: entry.table,
      rowId: entry.rowId,
      row: entry.row,
      reason,
      failedAt: nowIso(),
    })
    const current = await db.outbox.get(entry.key)
    if (current?.rev === entry.rev) await db.outbox.delete(entry.key)
  })
}

/**
 * Writes a pulled page straight to the tables (no outbox entries), skipping rows with a pending
 * local edit, and advances the cursor in the same transaction.
 */
async function applyPulled(page: PullResponse) {
  const tables = [...SYNC_TABLES.map((t) => syncTable(t)), db.outbox, db.syncMeta]
  await db.transaction('rw', tables, async () => {
    for (const { table, row } of page.rows) {
      const t = table as SyncTable
      if (await db.outbox.get(outboxKey(t, row.id))) continue
      if (t === 'settings' && !(await replaceLocalSettings(row.userId, row.id))) continue
      await syncTable(t).put(row as never)
    }
    await setMeta('cursor', page.cursor)
  })
}

/**
 * The server keeps one settings row per user. Drops local settings rows under other ids, unless
 * one has a pending edit: then the pulled row is skipped and the next push converges.
 */
async function replaceLocalSettings(userId: string, keepId: string): Promise<boolean> {
  const others = await db.settings.filter((s) => s.userId === userId && s.id !== keepId).toArray()
  for (const s of others) {
    if (await db.outbox.get(outboxKey('settings', s.id))) return false
  }
  await db.settings.bulkDelete(others.map((s) => s.id))
  return true
}

/** The app's engine, wired to the real network, Better Auth and the shared status store. */
export const syncEngine = createSyncEngine()
