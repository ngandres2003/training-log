import { SYNC_TABLE_NAMES, type PullResponse, type PullRow } from '@training-log/contract'
import { asc, gt } from 'drizzle-orm'
import type { Db } from '../db/client.js'
import { scopedToUser, syncTables } from '../db/queries.js'
import { toWireRow } from './rows.js'

/**
 * The user's rows with `version > cursor` across every synced table, oldest first, at most
 * `limit` of them (KTD5). Tombstones are included. All tables are read from one snapshot so a
 * push committing mid-pull cannot make a later table show a version that an earlier table missed.
 */
export async function readPull(db: Db, userId: string, cursor: number, limit: number): Promise<PullResponse> {
  return db.transaction(
    async (tx) => {
      const found: (PullRow & { version: number })[] = []
      for (const table of SYNC_TABLE_NAMES) {
        const pg = syncTables[table]
        // `limit + 1` per table is enough: the merged first `limit + 1` rows come from these.
        const rows = await tx
          .select()
          .from(pg)
          .where(scopedToUser(pg, userId, gt(pg.version, cursor)))
          .orderBy(asc(pg.version))
          .limit(limit + 1)
        for (const r of rows) {
          found.push({ table, row: toWireRow(table, r), version: r.version } as PullRow & { version: number })
        }
      }
      found.sort((a, b) => a.version - b.version)
      const page = found.slice(0, limit)
      return {
        rows: page.map(({ table, row }) => ({ table, row }) as PullRow),
        cursor: page.at(-1)?.version ?? cursor,
        hasMore: found.length > limit,
      }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}
