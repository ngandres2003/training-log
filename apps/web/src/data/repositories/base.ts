import type { Id, SyncFields, SyncRowByTable, SyncTable } from '@training-log/domain'
import { db, syncTable } from '../db'
import { newId, nowIso } from '../ids'
import { writeRow } from '../outbox'
import { getLastKnownUser } from '../syncMeta'

/** Row fields a caller provides; sync fields are filled here. */
export type RowInput<T extends SyncTable> = Omit<SyncRowByTable[T], keyof SyncFields>
export type RowPatch<T extends SyncTable> = Partial<RowInput<T>>

/** Tables a write may touch besides the row's own: outbox and syncMeta (for userId). */
function writeScope(tables: SyncTable[]) {
  return [...tables.map((t) => syncTable(t)), db.outbox, db.syncMeta]
}

/** Runs `fn` in one read-write transaction over the given synced tables plus the outbox. */
export function inWriteTransaction<R>(tables: SyncTable[], fn: () => Promise<R>): Promise<R> {
  return db.transaction('rw', writeScope(tables), fn)
}

async function currentUserId(): Promise<Id> {
  const user = await getLastKnownUser()
  if (!user) throw new Error('No signed-in user on this device')
  return user.id
}

export function insertRow<T extends SyncTable>(table: T, input: RowInput<T>): Promise<SyncRowByTable[T]> {
  return inWriteTransaction([table], async () => {
    const row = {
      ...input,
      id: newId(),
      userId: await currentUserId(),
      updatedAt: nowIso(),
      deletedAt: null,
      version: 0,
    } as SyncRowByTable[T]
    return writeRow(table, row)
  })
}

/** Reads a row, hiding tombstones. */
export async function getLive<T extends SyncTable>(table: T, id: Id): Promise<SyncRowByTable[T] | undefined> {
  const row = await syncTable(table).get(id)
  return row && row.deletedAt === null ? row : undefined
}

export function updateRow<T extends SyncTable>(table: T, id: Id, patch: RowPatch<T>): Promise<SyncRowByTable[T]> {
  return inWriteTransaction([table], async () => {
    const current = await getLive(table, id)
    if (!current) throw new Error(`${table} ${id} not found`)
    const row = { ...current, ...patch, updatedAt: nowIso() } as SyncRowByTable[T]
    return writeRow(table, row)
  })
}

/** Tombstones live rows (sets `deletedAt`); missing or already deleted ids are skipped. */
export function softDeleteRows<T extends SyncTable>(table: T, ids: Id[]): Promise<void> {
  return inWriteTransaction([table], async () => {
    const at = nowIso()
    for (const id of ids) {
      const current = await getLive(table, id)
      if (!current) continue
      await writeRow(table, { ...current, deletedAt: at, updatedAt: at })
    }
  })
}

/** All live rows of a table matching an optional filter. */
export function listLive<T extends SyncTable>(
  table: T,
  filter: (row: SyncRowByTable[T]) => boolean = () => true,
): Promise<SyncRowByTable[T][]> {
  return syncTable(table)
    .filter((row) => row.deletedAt === null && filter(row))
    .toArray()
}

export function byOrder<R extends { order: number }>(a: R, b: R): number {
  return a.order - b.order
}
