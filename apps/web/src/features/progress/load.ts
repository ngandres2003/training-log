import type { Settings, WorkoutTables } from '@training-log/domain'
import { useLiveQuery } from 'dexie-react-hooks'
import { listLive } from '../../data/repositories/base'
import { DEFAULT_SETTINGS, getSettings } from '../../data/repositories/settings'
import { listWorkouts, type WorkoutListItem } from '../../data/repositories/workouts'

export interface ProgressData {
  tables: Omit<WorkoutTables, 'workouts'> & { workouts: WorkoutListItem[] }
  settings: Pick<Settings, 'unit' | 'weeklyGoal' | 'weekStart'>
}

async function loadProgress(): Promise<ProgressData> {
  const [workouts, workoutExercises, workoutSets, settings] = await Promise.all([
    listWorkouts(),
    listLive('workoutExercises'),
    listLive('workoutSets'),
    getSettings(),
  ])
  return {
    tables: { workouts, workoutExercises, workoutSets },
    settings: settings ?? DEFAULT_SETTINGS,
  }
}

/**
 * All workout tables plus the settings the progress screens need, live from Dexie
 * (KTD4). Progress is derived on the device from these rows (KTD7).
 */
export function useProgressData(): ProgressData | undefined {
  return useLiveQuery(loadProgress, [])
}
