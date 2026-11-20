import type { Id } from '@training-log/domain'
import { openFinish } from './ui-store'

/**
 * V5's FINALIZAR (after the unchecked-sets warning) and V6's FINALIZAR ENTRENO call this with the
 * active workout id. It opens V7 (sessions/FinishWorkout), which the workout layer shows in place
 * of V5; V7 saves or discards the workout and calls `closeWorkout()` itself.
 */
export function onFinishRequested(workoutId: Id): void {
  void workoutId
  openFinish()
}
