import { useSyncExternalStore } from 'react'
import { applyUpdate, isUpdateAvailable, subscribeUpdateAvailable } from '../pwa/register'
import { Toast } from '../ui/Toast'
import { useSyncSnapshot } from './SyncIndicator'

/**
 * "Hay una versión nueva" toast: shown when a new service worker is waiting (U8) or the server
 * refused this client's contract version (U7). The app never reloads on its own (mid-workout).
 */
export function UpdateToast() {
  const { updateAvailableRequired } = useSyncSnapshot()
  const workerWaiting = useSyncExternalStore(subscribeUpdateAvailable, isUpdateAvailable)
  if (!updateAvailableRequired && !workerWaiting) return null

  function update() {
    // With no waiting worker yet (server said outdated first), a reload fetches the new version.
    if (isUpdateAvailable()) applyUpdate()
    else window.location.reload()
  }

  return <Toast action={{ label: 'Actualizar', onClick: update }}>Hay una versión nueva de la app.</Toast>
}
