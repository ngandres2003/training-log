import { SYNC_TABLES } from '@training-log/domain'
import { db, syncTable } from '../../data/db'
import { setMeta } from '../../data/syncMeta'

export interface DeleteAllDeps {
  fetch: typeof fetch
  /** Reloads the app so it reopens on onboarding with no data. */
  reloadTo: (path: string) => void
}

const defaults: DeleteAllDeps = {
  fetch: (input, init) => globalThis.fetch(input, init),
  reloadTo: (path) => window.location.assign(path),
}

/**
 * Empties this device's data but keeps the signed-in user: every synced row, the outbox, rejected
 * changes, and the pull cursor (the server's versions restart after delete-all).
 */
export async function clearLocalData(): Promise<void> {
  await db.transaction(
    'rw',
    [...SYNC_TABLES.map((t) => syncTable(t)), db.outbox, db.syncErrors, db.syncMeta],
    async () => {
      for (const t of SYNC_TABLES) await syncTable(t).clear()
      await db.outbox.clear()
      await db.syncErrors.clear()
      await setMeta('cursor', 0)
      await setMeta('lastSyncedAt', null)
    },
  )
}

/**
 * "Borrar todos mis datos" (U15 step 4): the server deletes the user's rows and photos and signs
 * out their other devices (`DELETE /api/account`); then this device's data is cleared.
 * Throws when the server call fails, leaving local data untouched.
 */
export async function deleteAllMyData(deps: Partial<DeleteAllDeps> = {}): Promise<void> {
  const { fetch, reloadTo } = { ...defaults, ...deps }
  const res = await fetch('/api/account', { method: 'DELETE', credentials: 'include' })
  if (!res.ok) throw new Error(`Delete-all failed: ${res.status}`)
  await clearLocalData()
  reloadTo('/')
}
