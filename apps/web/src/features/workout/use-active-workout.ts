import type { Workout } from '@training-log/domain'
import { useLiveQuery } from 'dexie-react-hooks'
import { getActiveWorkout } from '../../data/repositories/workouts'

/**
 * The `status: active` workout (KTD9): `undefined` while loading, `null` when there is none.
 * Shared by the layer and the mini-player, which decide their own visibility from it.
 */
export function useActiveWorkout(): Workout | null | undefined {
  return useLiveQuery(async () => (await getActiveWorkout()) ?? null, [])
}
