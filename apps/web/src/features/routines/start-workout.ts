import type { Id, Workout } from '@training-log/domain'
import { getRoutine } from '../../data/repositories/routines'
import { getActiveWorkout, startWorkout } from '../../data/repositories/workouts'

export const FREE_WORKOUT_NAME = 'Entreno libre'

/**
 * HOOK POINT for U13 (active workout): every start in the Inicio tab goes through here —
 * "▶ Iniciar" on a card, V2 or "Toca hoy" (routine id), "Empezar entreno vacío" (null) and the
 * "Continuar entreno" banner (the active workout's routine id).
 *
 * Today it only makes sure there is one `status: active` workout: if one is in progress it is
 * resumed (never a second one), otherwise a new one is started for the routine.
 * TODO(U13): copy the routine's exercises and sets into the workout and open V5 expanded.
 */
export async function onStartRoutine(routineId: Id | null): Promise<Workout> {
  const active = await getActiveWorkout()
  if (active) return active
  const routine = routineId ? await getRoutine(routineId) : undefined
  return startWorkout({ routineId: routine?.id ?? null, name: routine?.name ?? FREE_WORKOUT_NAME })
}
