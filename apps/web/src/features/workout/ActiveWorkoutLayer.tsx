import { useEffect, useState } from 'react'
import { remainingRestMs, scheduleRestEnd } from '../../pwa/notify'
import { ActiveWorkout } from './ActiveWorkout'
import { useWorkoutUi } from './ui-store'
import { useActiveWorkout } from './use-active-workout'
import { useNow } from './use-now'

/**
 * Global active-workout layer (spec "Capas globales"): V5 full screen while expanded. It stays
 * mounted while a workout is active, minimized or not, so the rest-end alert fires and is
 * announced to screen readers (KTD16) wherever the user is in the app.
 */
export function ActiveWorkoutLayer() {
  const workout = useActiveWorkout()
  const ui = useWorkoutUi()

  // Whoever finishes or discards the workout calls `closeWorkout()` (ui-store); without an
  // active workout nothing renders anyway.
  if (!workout) return null

  return (
    <>
      <RestEndAlert restEndsAt={workout.restEndsAt} body={workout.name} />
      {ui.expanded && <ActiveWorkout workoutId={workout.id} />}
    </>
  )
}

/**
 * Vibration, tone and (in the background) notification at `restEndsAt`, plus a live region that
 * says "Descanso terminado" once a rest seen running reaches zero. Remaining time is always
 * derived from `restEndsAt` (KTD9), so a rest that ended while the app was closed is not announced.
 */
function RestEndAlert({ restEndsAt, body }: { restEndsAt: string | null; body: string }) {
  const now = useNow(restEndsAt !== null)
  const remaining = remainingRestMs(restEndsAt, now)
  const [running, setRunning] = useState<string | null>(null)
  const [ended, setEnded] = useState<string | null>(null)

  // Derived from the previous render (React's "adjust state while rendering" pattern).
  if (restEndsAt && remaining > 0 && running !== restEndsAt) setRunning(restEndsAt)
  if (restEndsAt && remaining === 0 && running === restEndsAt && ended !== restEndsAt) setEnded(restEndsAt)

  useEffect(() => {
    if (!restEndsAt || remainingRestMs(restEndsAt, Date.now()) === 0) return
    const scheduled = scheduleRestEnd({ restEndsAt, title: 'Descanso terminado', body })
    return scheduled.cancel
  }, [restEndsAt, body])

  return (
    <div aria-live="assertive" aria-atomic="true" className="sr-only">
      {ended !== null && ended === restEndsAt ? 'Descanso terminado' : ''}
    </div>
  )
}
