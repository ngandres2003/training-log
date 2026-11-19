/**
 * Sync status store for the global indicator (R6) and V12. Framework-free: React reads it with
 * `useSyncExternalStore(store.subscribe, store.getSnapshot)`.
 */

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'offline' | 'authExpired'

export interface SyncSnapshot {
  status: SyncStatus
  /** Outbox entries waiting to be pushed. */
  pendingCount: number
  /** Changes the server rejected (shown in V12). */
  errorCount: number
  lastSyncedAt: string | null
  /** The server refused this client's contract version: show the update toast. */
  updateAvailableRequired: boolean
}

/** Raw inputs the engine and triggers set; `status` is derived from them. */
export interface SyncFlags {
  online: boolean
  syncing: boolean
  authExpired: boolean
  pendingCount: number
  errorCount: number
  lastSyncedAt: string | null
  updateAvailableRequired: boolean
}

export interface SyncStatusStore {
  subscribe(listener: () => void): () => void
  getSnapshot(): SyncSnapshot
  update(patch: Partial<SyncFlags>): void
}

function deriveStatus(f: SyncFlags): SyncStatus {
  if (f.authExpired) return 'authExpired'
  if (!f.online) return 'offline'
  if (f.syncing) return 'syncing'
  return f.pendingCount > 0 ? 'pending' : 'synced'
}

function toSnapshot(f: SyncFlags): SyncSnapshot {
  return {
    status: deriveStatus(f),
    pendingCount: f.pendingCount,
    errorCount: f.errorCount,
    lastSyncedAt: f.lastSyncedAt,
    updateAvailableRequired: f.updateAvailableRequired,
  }
}

const sameSnapshot = (a: SyncSnapshot, b: SyncSnapshot) =>
  (Object.keys(a) as (keyof SyncSnapshot)[]).every((k) => a[k] === b[k])

export function createSyncStatusStore(initial: Partial<SyncFlags> = {}): SyncStatusStore {
  let flags: SyncFlags = {
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    syncing: false,
    authExpired: false,
    pendingCount: 0,
    errorCount: 0,
    lastSyncedAt: null,
    updateAvailableRequired: false,
    ...initial,
  }
  let snapshot = toSnapshot(flags)
  const listeners = new Set<() => void>()

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
    update(patch) {
      flags = { ...flags, ...patch }
      const next = toSnapshot(flags)
      // Keep the same object when nothing visible changed, as useSyncExternalStore requires.
      if (sameSnapshot(next, snapshot)) return
      snapshot = next
      for (const l of listeners) l()
    },
  }
}

/** The app-wide store used by the default engine. */
export const syncStatus = createSyncStatusStore()

export interface IndicatorState {
  state: 'sincronizado' | 'pendiente' | 'sin-conexion'
  /** Shown next to "sin conexión" (and "pendiente") when the outbox is not empty. */
  pendingCount: number
  /** `authExpired`: logging keeps working; offer the re-auth sheet (U3). */
  showReauthBanner: boolean
}

/** R6 visual mapping of the sync status (High-Level Technical Design). */
export function indicatorState(s: SyncSnapshot): IndicatorState {
  const state = s.status === 'synced' ? 'sincronizado' : s.status === 'offline' ? 'sin-conexion' : 'pendiente'
  return { state, pendingCount: s.pendingCount, showReauthBanner: s.status === 'authExpired' }
}
