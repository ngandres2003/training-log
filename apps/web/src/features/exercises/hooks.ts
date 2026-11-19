import type { WeightUnit, WorkoutTables } from '@training-log/domain'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { listLive } from '../../data/repositories/base'
import { getSettings } from '../../data/repositories/settings'

export async function loadWorkoutTables(): Promise<WorkoutTables> {
  const [workouts, workoutExercises, workoutSets] = await Promise.all([
    listLive('workouts'),
    listLive('workoutExercises'),
    listLive('workoutSets'),
  ])
  return { workouts, workoutExercises, workoutSets }
}

const EMPTY: WorkoutTables = { workouts: [], workoutExercises: [], workoutSets: [] }

/** Local workouts, live; feeds "última vez" and the delete rule for custom exercises. */
export function useWorkoutTables(): WorkoutTables {
  return useLiveQuery(loadWorkoutTables, [], EMPTY)
}

export function useWeightUnit(): WeightUnit {
  return useLiveQuery(async () => (await getSettings())?.unit ?? 'kg', [], 'kg' as WeightUnit)
}

/** Browser connectivity (navigator.onLine plus online/offline events). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}
