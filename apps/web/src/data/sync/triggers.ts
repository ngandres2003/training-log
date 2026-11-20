import { liveQuery } from 'dexie'
import { db } from '../db'
import { syncEngine, type SyncEngine } from './engine'

export interface SyncTriggerOptions {
  /** Delay after the last local write before a cycle runs. */
  debounceMs?: number
  /** Slow periodic cycle while online. */
  intervalMs?: number
  isOnline?: () => boolean
  target?: Window
  doc?: Document
}

/**
 * Starts the sync triggers (U7 step 2): app start, `online`, visibility regained, a debounced
 * cycle after local writes, and a slow interval while online. Returns a stop function.
 */
export function startSyncTriggers(engine: SyncEngine = syncEngine, opts: SyncTriggerOptions = {}): () => void {
  const { debounceMs = 2_000, intervalMs = 60_000, target = window, doc = document } = opts
  const isOnline = opts.isOnline ?? (() => navigator.onLine)
  let debounce: ReturnType<typeof setTimeout> | undefined

  const run = () => void engine.sync()

  const scheduleAfterWrite = () => {
    clearTimeout(debounce)
    debounce = setTimeout(() => {
      // A write that lands during a cycle may not be in its push; wait for the cycle to end.
      if (engine.isRunning()) scheduleAfterWrite()
      else run()
    }, debounceMs)
  }

  const onOnline = () => {
    engine.status.update({ online: true })
    run()
  }
  const onOffline = () => engine.status.update({ online: false })
  const onVisibility = () => doc.visibilityState === 'visible' && run()

  target.addEventListener('online', onOnline)
  target.addEventListener('offline', onOffline)
  doc.addEventListener('visibilitychange', onVisibility)
  const interval = setInterval(() => isOnline() && run(), intervalMs)

  // Local writes: every repository write adds or bumps an outbox entry (KTD5), so a new key or a
  // higher rev means a new local change. Removals (by the engine) only refresh the counts.
  let seen: Map<string, number> | null = null
  const subscription = liveQuery(() => db.outbox.toArray()).subscribe({
    next(entries) {
      const prev = seen
      seen = new Map(entries.map((e) => [e.key, e.rev]))
      void engine.refreshCounts()
      if (prev && entries.some((e) => (prev.get(e.key) ?? 0) < e.rev)) scheduleAfterWrite()
    },
  })

  engine.status.update({ online: isOnline() })
  run()

  return () => {
    target.removeEventListener('online', onOnline)
    target.removeEventListener('offline', onOffline)
    doc.removeEventListener('visibilitychange', onVisibility)
    clearInterval(interval)
    clearTimeout(debounce)
    subscription.unsubscribe()
  }
}
