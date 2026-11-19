import { del, list } from '@vercel/blob'
import { eq } from 'drizzle-orm'
import type { Db } from '../db/client.js'
import { syncTables, type SyncPgTable } from '../db/queries.js'
import { syncCounters } from '../db/schema.js'

/** The two Vercel Blob calls delete-all needs; injectable so tests use an in-memory store. */
export interface BlobClient {
  list(options: { prefix: string; cursor?: string; token?: string }): Promise<{
    blobs: { pathname: string; url: string }[]
    hasMore: boolean
    cursor?: string
  }>
  del(urls: string[], options: { token?: string }): Promise<void>
}

export const vercelBlob: BlobClient = {
  list: (options) => list(options),
  del: (urls, options) => del(urls, options),
}

/** Where the user's custom exercise photos live (see uploads/token.ts). */
export function userPhotoPrefix(userId: string): string {
  return `custom-exercises/${userId}/`
}

/** Deletes every synced row of `userId` and their version counter, in one transaction. */
export async function deleteUserRows(db: Db, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    for (const pg of Object.values(syncTables) as SyncPgTable[]) {
      await tx.delete(pg).where(eq(pg.userId, userId))
    }
    await tx.delete(syncCounters).where(eq(syncCounters.userId, userId))
  })
}

/** Deletes every Blob object under the user's prefix, page by page. */
export async function deleteUserPhotos(
  blob: BlobClient,
  userId: string,
  token: string | undefined,
): Promise<void> {
  const prefix = userPhotoPrefix(userId)
  // Deleting shifts later pages, so always list from the start until nothing is left.
  for (;;) {
    const page = await blob.list({ prefix, token })
    if (page.blobs.length === 0) return
    await blob.del(
      page.blobs.map((b) => b.url),
      { token },
    )
    if (!page.hasMore) return
  }
}
