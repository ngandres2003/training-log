import 'fake-indexeddb/auto'
import type { PullResponse, PushOutcome, PushRequest } from '@training-log/contract'
import { SYNC_TABLES, type SyncRowByTable, type SyncTable } from '@training-log/domain'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, syncTable } from '../../data/db'
import { pendingEntries } from '../../data/outbox'
import { saveSettings } from '../../data/repositories/settings'
import { createSyncEngine } from '../../data/sync/engine'
import { createSyncStatusStore } from '../../data/sync/status'
import { setLastKnownUser } from '../../data/syncMeta'
import { resetDb } from '../../data/testUtils'
import { buildJsonExport, type ExportFile } from './export'
import { importExport, parseExport } from './import'
import { seedAccount } from './test-fixtures'

const BEA = { id: '0190f0c0-0000-7000-8000-0000000000be', email: 'bea@example.com' }

beforeEach(resetDb)

async function snapshot() {
  const out: Record<string, unknown[]> = {}
  for (const t of SYNC_TABLES) {
    const rows = await syncTable(t).toArray()
    out[t] = rows.map(({ updatedAt: _u, ...rest }) => rest).sort((a, b) => a.id.localeCompare(b.id))
  }
  return out
}

async function allRows(): Promise<{ [T in SyncTable]: SyncRowByTable[T][] }> {
  const out: Record<string, unknown[]> = {}
  for (const t of SYNC_TABLES) out[t] = await syncTable(t).toArray()
  return out as { [T in SyncTable]: SyncRowByTable[T][] }
}

/** Export through a JSON string, as a downloaded file would be. */
async function exportedText(): Promise<string> {
  return JSON.stringify(await buildJsonExport())
}

function allIds(file: ExportFile): Set<string> {
  return new Set(SYNC_TABLES.flatMap((t) => file.tables[t].map((r) => r.id)))
}

describe('JSON import', () => {
  it('round-trips into an empty device of the same account with the same ids and content', async () => {
    await seedAccount()
    const before = await snapshot()
    const text = await exportedText()

    await resetDb()
    const result = await importExport(parseExport(text))

    expect(result.mode).toBe('same-account')
    expect(await snapshot()).toEqual(before)
    // Written through the outbox, so the rows sync.
    expect(await pendingEntries()).toHaveLength(Object.values(before).flat().length)
  })

  it('gives every row from another account a new id, keeps every link, and syncs with zero rejections', async () => {
    await seedAccount()
    const file = parseExport(await exportedText())
    const accountAIds = allIds(file)

    // Bea, on a fresh device, already has her own settings row.
    await resetDb()
    await setLastKnownUser(BEA)
    const beaSettings = await saveSettings({
      displayName: 'Bea',
      onboardedAt: '2026-11-01T00:00:00.000Z',
    })

    const result = await importExport(file)
    expect(result.mode).toBe('other-account')

    const rows = await allRows()

    // Same row counts; no id reused from account A; everything owned by Bea.
    for (const t of SYNC_TABLES) {
      expect(rows[t]).toHaveLength(file.tables[t].length)
      for (const r of rows[t]) {
        expect(accountAIds.has(r.id)).toBe(false)
        expect(r.userId).toBe(BEA.id)
      }
    }

    // Settings merge into Bea's existing row (one per user) and take the imported preferences.
    expect(rows.settings).toEqual([
      expect.objectContaining({
        id: beaSettings.id,
        displayName: 'Ana',
        weeklyGoal: 4,
        onboardedAt: beaSettings.onboardedAt,
      }),
    ])

    const [folder] = rows.folders
    const [custom] = rows.customExercises
    const [routine] = rows.routines
    const [re] = rows.routineExercises
    const [rs] = rows.routineSets
    const [workout] = rows.workouts
    expect(routine!.folderId).toBe(folder!.id)
    expect(re).toMatchObject({
      routineId: routine!.id,
      exerciseId: custom!.id,
      supersetGroup: 'g1',
    })
    expect(rs!.routineExerciseId).toBe(re!.id)
    expect(workout!.routineId).toBe(routine!.id)
    const wes = rows.workoutExercises.sort((a, b) => a.order - b.order)
    expect(wes).toEqual([
      expect.objectContaining({
        workoutId: workout!.id,
        exerciseId: custom!.id,
        routineExerciseId: re!.id,
      }),
      // Catalog exercise ids are shared by every user and stay as they are.
      expect.objectContaining({
        workoutId: workout!.id,
        exerciseId: 'plank',
        routineExerciseId: null,
      }),
    ])
    const setsPerExercise = wes.map(
      (we) => rows.workoutSets.filter((s) => s.workoutExerciseId === we.id).length,
    )
    expect(setsPerExercise).toEqual([3, 1])

    // A server that still holds account A's rows rejects any of their ids (foreign_id).
    const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith('/api/sync/push')) {
        const body = JSON.parse(String(init!.body)) as PushRequest
        const outcomes: PushOutcome[] = body.changes.map((c) => ({
          table: c.table,
          id: c.row.id,
          rev: c.rev,
          ...(accountAIds.has(c.row.id)
            ? { status: 'rejected', reason: 'foreign_id' }
            : { status: 'accepted' }),
        }))
        return Response.json({ outcomes })
      }
      return Response.json({ rows: [], cursor: 0, hasMore: false } satisfies PullResponse)
    }
    const engine = createSyncEngine({
      fetch: fetch as typeof globalThis.fetch,
      checkSession: async () => ({ kind: 'ok', userId: BEA.id }),
      isOnline: () => true,
      status: createSyncStatusStore({ online: true }),
      schedule: () => () => {},
    })
    expect(await engine.sync()).toBe('ok')
    expect(await db.syncErrors.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('rejects a file that is not an export', () => {
    expect(() => parseExport('{"hello":1}')).toThrow()
    expect(() => parseExport('not json')).toThrow()
  })
})
