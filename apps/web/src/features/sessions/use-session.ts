import type { Exercise, Id } from '@training-log/domain'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { useExerciseLookup } from '../exercises/catalog'
import { buildWorkoutModel, type WorkoutModel } from '../workout/view-model'
import { loadSessionData, type SessionData } from './session-data'

export interface SessionView {
  /** Undefined while loading, null when the workout does not exist (or was deleted). */
  data: SessionData | null | undefined
  model: WorkoutModel | null
  lookup: Map<Id, Exercise>
}

/** Live session data plus the V5 view model built from it (rows, PR badges, volume). */
export function useSession(workoutId: Id): SessionView {
  const data = useLiveQuery(() => loadSessionData(workoutId), [workoutId])
  const { byId } = useExerciseLookup()
  const model = useMemo(() => (data ? buildWorkoutModel(data, byId) : null), [data, byId])
  return { data, model, lookup: byId }
}
