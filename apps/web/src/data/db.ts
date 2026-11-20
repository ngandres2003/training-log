import Dexie, { type Table } from 'dexie'
import type { Id, SyncRowByTable, SyncTable } from '@training-log/domain'

/** One pending change per row; `key` is `${table}:${rowId}` (KTD5). */
export interface OutboxEntry<T extends SyncTable = SyncTable> {
  key: string
  table: T
  rowId: Id
  /** Full row snapshot to push. */
  row: SyncRowByTable[T]
  /** Local revision; increases every time the entry is replaced. */
  rev: number
  updatedLocallyAt: string
}

export interface LastKnownUser {
  id: Id
  email: string
}

export interface SyncMetaValues {
  /** Highest server version pulled so far. */
  cursor: number
  lastSyncedAt: string | null
  lastKnownUser: LastKnownUser | null
}

export type SyncMetaKey = keyof SyncMetaValues

export type SyncMetaRow = { [K in SyncMetaKey]: { key: K; value: SyncMetaValues[K] } }[SyncMetaKey]

/** A change the server rejected, moved out of the outbox (KTD5 step 3). Filled by the sync engine. */
export interface SyncErrorEntry {
  key: string
  table: SyncTable
  rowId: Id
  row: unknown
  reason: string
  failedAt: string
}

type SyncTables = { [T in SyncTable]: Table<SyncRowByTable[T], Id> }

export type TrainingDb = Dexie &
  SyncTables & {
    outbox: Table<OutboxEntry, string>
    syncMeta: Table<SyncMetaRow, SyncMetaKey>
    syncErrors: Table<SyncErrorEntry, string>
  }

/** Index definitions; typed by table name so every synced table must appear. */
const SYNC_TABLE_SCHEMA: Record<SyncTable, string> = {
  settings: 'id',
  folders: 'id',
  routines: 'id, folderId',
  routineExercises: 'id, routineId',
  routineSets: 'id, routineExerciseId',
  workouts: 'id, routineId, status, startedAt',
  workoutExercises: 'id, workoutId, exerciseId',
  workoutSets: 'id, workoutExerciseId',
  customExercises: 'id',
}

export const db = new Dexie('training-log') as TrainingDb

db.version(1).stores({
  ...SYNC_TABLE_SCHEMA,
  outbox: 'key, table, updatedLocallyAt',
  syncMeta: 'key',
  syncErrors: 'key, table',
})

export type Loose = Record<string, unknown>

/**
 * Rest moved from the global `settings.defaultRestSec` to each workout exercise (contract v2).
 * Brings a row written before that change up to date in place: a workout exercise without
 * `restSec` gets null (no rest timer) and settings lose the old field. Used by the v2 upgrade
 * below and by the JSON import, which accepts exports made before the change.
 */
export function moveRestToWorkoutExercises(table: string, row: Loose): void {
  if (table === 'workoutExercises' && row.restSec === undefined) row.restSec = null
  if (table === 'settings') delete row.defaultRestSec
}

// v2: the tables and pending outbox snapshots are brought up to date so they push as valid v2 rows.
db.version(2)
  .stores({})
  .upgrade(async (tx) => {
    await tx
      .table('workoutExercises')
      .toCollection()
      .modify((row: Loose) => moveRestToWorkoutExercises('workoutExercises', row))
    await tx
      .table('settings')
      .toCollection()
      .modify((row: Loose) => moveRestToWorkoutExercises('settings', row))
    await tx
      .table('outbox')
      .toCollection()
      .modify((entry: OutboxEntry) => moveRestToWorkoutExercises(entry.table, entry.row as unknown as Loose))
  })

export function syncTable<T extends SyncTable>(table: T): Table<SyncRowByTable[T], Id> {
  return db.table(table)
}
