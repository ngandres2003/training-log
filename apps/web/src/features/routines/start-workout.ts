import type { Id, Workout } from '@training-log/domain'
import { openWorkout } from '../workout/ui-store'
import { startOrResumeWorkout } from '../workout/workout-actions'

/**
 * Every start in the Inicio tab goes through here — "▶ Iniciar" on a card, V2 or "Toca hoy"
 * (routine id), "Entreno libre" (null) and the "Continuar entreno" banner (the active
 * workout's routine id).
 *
 * There is only ever one `status: active` workout: if one is in progress it is resumed (never a
 * second one), otherwise a new one is started copying the routine's exercises and sets. Either
 * way V5 opens expanded over the current tab.
 */
export async function onStartRoutine(routineId: Id | null): Promise<Workout> {
  const workout = await startOrResumeWorkout(routineId)
  openWorkout()
  return workout
}
