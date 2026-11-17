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

export function syncTable<T extends SyncTable>(table: T): Table<SyncRowByTable[T], Id> {
  return db.table(table)
}
