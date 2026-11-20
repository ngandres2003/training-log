import { db, type LastKnownUser, type SyncMetaKey, type SyncMetaValues } from './db'

const DEFAULTS: SyncMetaValues = { cursor: 0, lastSyncedAt: null, lastKnownUser: null }

export async function getMeta<K extends SyncMetaKey>(key: K): Promise<SyncMetaValues[K]> {
  const row = await db.syncMeta.get(key)
  return row ? (row.value as SyncMetaValues[K]) : DEFAULTS[key]
}

export async function setMeta<K extends SyncMetaKey>(key: K, value: SyncMetaValues[K]): Promise<void> {
  await db.syncMeta.put({ key, value } as Extract<Parameters<typeof db.syncMeta.put>[0], { key: K }>)
}

export function getLastKnownUser(): Promise<LastKnownUser | null> {
  return getMeta('lastKnownUser')
}

export function setLastKnownUser(user: LastKnownUser | null): Promise<void> {
  return setMeta('lastKnownUser', user)
}
