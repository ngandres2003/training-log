import type { SyncTable } from '@training-log/domain'
import { and, eq, sql, type SQL } from 'drizzle-orm'
import type { Db, Tx } from './client.js'
import {
  customExercises,
  folders,
  routineExercises,
  routineSets,
  routines,
  settings,
  syncCounters,
  workoutExercises,
  workoutSets,
  workouts,
} from './schema.js'

/** Shared sync table name (`SYNC_TABLES`) to its Postgres table. */
export const syncTables = {
  settings,
  folders,
  routines,
  routineExercises,
  routineSets,
  workouts,
  workoutExercises,
  workoutSets,
  customExercises,
} as const satisfies Record<SyncTable, unknown>

export type SyncPgTable<T extends SyncTable = SyncTable> = (typeof syncTables)[T]

/** `user_id = userId`, optionally combined with more conditions. Every query on a synced table goes through this. */
export function scopedToUser(table: SyncPgTable, userId: string, ...more: (SQL | undefined)[]): SQL {
  return and(eq(table.userId, userId), ...more) as SQL
}

/** All rows of one synced table owned by `userId`, optionally narrowed by `where`. */
export function selectForUser<T extends SyncTable>(db: Db | Tx, table: T, userId: string, where?: SQL) {
  const pg = syncTables[table] as SyncPgTable
  return db
    .select()
    .from(pg)
    .where(scopedToUser(pg, userId, where)) as unknown as Promise<SyncPgTable<T>['$inferSelect'][]>
}

/**
 * Reserves `n` consecutive versions from the user's counter (KTD5) and returns them in order.
 * Must run inside the push transaction: the upsert locks the counter row until commit, so
 * versions for one user commit in order.
 */
export async function nextVersions(tx: Tx, userId: string, n: number): Promise<number[]> {
  const [row] = await tx
    .insert(syncCounters)
    .values({ userId, value: n })
    .onConflictDoUpdate({ target: syncCounters.userId, set: { value: sql`${syncCounters.value} + ${n}` } })
    .returning({ value: syncCounters.value })
  const last = row!.value
  return Array.from({ length: n }, (_, i) => last - n + 1 + i)
}
