import { Workbox } from 'workbox-window'

/**
 * Registers the service worker and exposes an "update available" signal for a toast.
 * A new version waits until the user chooses to reload: never auto-reload mid-workout.
 */

let workbox: Workbox | null = null
let updateAvailable = false
const listeners = new Set<() => void>()

function setUpdateAvailable(value: boolean) {
  updateAvailable = value
  listeners.forEach((listener) => listener())
}

/** Subscribe for useSyncExternalStore together with isUpdateAvailable. */
export function subscribeUpdateAvailable(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isUpdateAvailable(): boolean {
  return updateAvailable
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || workbox) return
  workbox = new Workbox('/sw.js', { scope: '/' })
  workbox.addEventListener('waiting', () => setUpdateAvailable(true))
  void workbox.register()

  // An installed app can stay open for days: look for a new version when it comes back to the
  // foreground, and hourly while it stays there. The toast still waits for the user.
  const wb = workbox
  const check = () => void wb.update().catch(() => undefined)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
  setInterval(check, UPDATE_CHECK_MS)
}

const UPDATE_CHECK_MS = 60 * 60 * 1000

/** Called from the toast's "Actualizar" button: activates the new worker, then reloads. */
export function applyUpdate(): void {
  const wb = workbox
  if (!wb || !updateAvailable) return
  wb.addEventListener('controlling', () => window.location.reload())
  wb.messageSkipWaiting()
}
