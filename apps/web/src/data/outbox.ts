import type { Id, SyncRowByTable, SyncTable } from '@training-log/domain'
import { db, syncTable, type OutboxEntry } from './db'
import { nowIso } from './ids'

export function outboxKey(table: SyncTable, rowId: Id): string {
  return `${table}:${rowId}`
}

/**
 * Writes a row and upserts its outbox entry in one transaction (KTD5).
 * Joins the caller's transaction when one is open over these tables.
 */
export async function writeRow<T extends SyncTable>(table: T, row: SyncRowByTable[T]): Promise<SyncRowByTable[T]> {
  return db.transaction('rw', [syncTable(table), db.outbox], async () => {
    await syncTable(table).put(row)
    const key = outboxKey(table, row.id)
    const existing = await db.outbox.get(key)
    const entry: OutboxEntry<T> = {
      key,
      table,
      rowId: row.id,
      row,
      rev: (existing?.rev ?? 0) + 1,
      updatedLocallyAt: nowIso(),
    }
    await db.outbox.put(entry as unknown as OutboxEntry)
    return row
  })
}

/** Pending changes, oldest local edit first. */
export function pendingEntries(): Promise<OutboxEntry[]> {
  return db.outbox.orderBy('updatedLocallyAt').toArray()
}

/**
 * Removes an entry after a successful push, but only if it was not replaced
 * since it was sent. Returns whether it was removed.
 */
export function clearIfRevMatches(key: string, rev: number): Promise<boolean> {
  return db.transaction('rw', db.outbox, async () => {
    const entry = await db.outbox.get(key)
    if (!entry || entry.rev !== rev) return false
    await db.outbox.delete(key)
    return true
  })
}
