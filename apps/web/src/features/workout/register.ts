import { registerActiveWorkoutUi, type ActiveWorkoutUi } from '../../app/active-workout-slot'
import { ActiveWorkoutLayer } from './ActiveWorkoutLayer'
import { MiniPlayer } from './MiniPlayer'
import { openWorkout } from './ui-store'

/** Fills the AppLayout slot for the active-workout layer and mini-player (imported from main.tsx). */
export const activeWorkoutUi: ActiveWorkoutUi = { Layer: ActiveWorkoutLayer, MiniPlayer }

registerActiveWorkoutUi(activeWorkoutUi)

/**
 * A tap on the rest-end notification opens the workout: the service worker messages an open
 * window, or opens a new one at `/?entreno=1`. Without an active workout nothing shows.
 */
if (typeof window !== 'undefined') {
  navigator.serviceWorker?.addEventListener('message', (event: MessageEvent) => {
    if ((event.data as { type?: string } | null)?.type === 'open-workout') openWorkout()
  })
  const url = new URL(window.location.href)
  if (url.searchParams.get('entreno') === '1') {
    url.searchParams.delete('entreno')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    openWorkout()
  }
}
