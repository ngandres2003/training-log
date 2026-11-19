import type { Equipment, Id, TrackingType } from '@training-log/domain'
import { vi } from 'vitest'
import { createCustomExercise } from '../../data/repositories/exercises'
import { addWorkoutExercise, addWorkoutSet, startWorkout, updateWorkout } from '../../data/repositories/workouts'
import { resetCatalogCache, type CatalogEntry } from './catalog'

function entry(
  id: string,
  name: string,
  nameEn: string,
  primaryMuscle: string,
  equipment: Equipment,
  trackingType: TrackingType = 'weight_reps',
): CatalogEntry {
  return {
    id,
    name,
    nameEn,
    primaryMuscle,
    secondaryMuscles: [],
    equipment,
    trackingType,
    imageUrl: null,
    mediaId: id,
    instructionsEs: [],
  }
}

export const CATALOG_FIXTURE: CatalogEntry[] = [
  entry('cat-1', 'Press de banca con barra', 'barbell bench press', 'chest', 'barbell'),
  entry('cat-2', 'Press banca inclinado', 'incline bench press', 'chest', 'dumbbell'),
  entry('cat-3', 'Sentadilla con barra', 'barbell full squat', 'quadriceps', 'barbell'),
  entry('cat-4', 'Curl de bíceps', 'dumbbell biceps curl', 'biceps', 'dumbbell'),
  entry('cat-5', 'Dominada', 'pull-up', 'lats', 'bodyweight', 'reps'),
]

/** Serves the catalog fixture (or a failure) to `loadCatalog`. */
export function stubCatalog(ok = true) {
  resetCatalogCache()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (!ok) throw new TypeError('offline')
      return new Response(JSON.stringify(CATALOG_FIXTURE), { status: 200 })
    }),
  )
}

export function addCustom(name: string, equipment: Equipment = 'cable', primaryMuscle = 'middle_back') {
  return createCustomExercise({
    name,
    primaryMuscle,
    secondaryMuscles: [],
    equipment,
    trackingType: 'weight_reps',
    imageUrl: null,
  })
}

/** A finished workout with one exercise and the given completed sets. */
export async function addFinishedWorkout(exerciseId: Id, sets: { weight: number; reps: number }[]) {
  const workout = await startWorkout({ routineId: null, name: 'Libre', startedAt: '2026-11-10T10:00:00.000Z' })
  await updateWorkout(workout.id, { status: 'finished', endedAt: '2026-11-10T11:00:00.000Z' })
  const we = await addWorkoutExercise({
    workoutId: workout.id,
    exerciseId,
    routineExerciseId: null,
    order: 0,
    note: '',
    supersetGroup: null,
  })
  for (const [order, s] of sets.entries()) {
    await addWorkoutSet({
      workoutExerciseId: we.id,
      order,
      type: 'normal',
      weight: s.weight,
      reps: s.reps,
      durationSec: null,
      rpe: null,
      completed: true,
      completedAt: '2026-11-10T10:10:00.000Z',
    })
  }
  return workout
}
