import { render } from '@testing-library/react'
import type { Id, SetType, TrackingType } from '@training-log/domain'
import { createMemoryRouter, RouterProvider, useParams } from 'react-router'
import { vi } from 'vitest'
import { addRoutineExercise, addRoutineSet, createRoutine } from '../../data/repositories/routines'
import { addWorkoutExercise, addWorkoutSet, startWorkout, updateWorkout } from '../../data/repositories/workouts'
import { resetCatalogCache, type CatalogEntry } from '../exercises/catalog'
import { activeWorkoutUi } from './register'

function entry(id: string, name: string, trackingType: TrackingType, primaryMuscle: string): CatalogEntry {
  return {
    id,
    name,
    nameEn: name,
    primaryMuscle,
    secondaryMuscles: [],
    equipment: 'barbell',
    trackingType,
    imageUrl: null,
    mediaId: id,
    instructionsEs: [],
  }
}

export const CATALOG: CatalogEntry[] = [
  entry('ex-banca', 'Press banca', 'weight_reps', 'chest'),
  entry('ex-remo', 'Remo con barra', 'weight_reps', 'middle_back'),
  entry('ex-fondos', 'Fondos en paralelas', 'reps', 'triceps'),
  entry('ex-plancha', 'Plancha', 'time', 'abdominals'),
  entry('ex-sentadilla', 'Sentadilla', 'weight_reps', 'quadriceps'),
]

/** Serves the tiny catalog fixture instead of the real JSON. */
export function stubCatalog() {
  resetCatalogCache()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(CATALOG), { status: 200 })),
  )
}

export interface SeedSet {
  weight?: number | null
  reps?: number | null
  durationSec?: number | null
  type?: SetType
}

/** A routine whose exercises have `sets` normal target sets (or explicit targets). */
export async function seedRoutine(input: {
  name: string
  exercises: {
    exerciseId: Id
    sets: number | SeedSet[]
    restSec?: number | null
    supersetGroup?: string | null
  }[]
}) {
  const r = await createRoutine({ name: input.name })
  for (const [i, ex] of input.exercises.entries()) {
    const re = await addRoutineExercise({
      routineId: r.id,
      exerciseId: ex.exerciseId,
      order: i,
      restSec: ex.restSec ?? null,
      supersetGroup: ex.supersetGroup ?? null,
    })
    const sets: SeedSet[] = typeof ex.sets === 'number' ? Array.from({ length: ex.sets }, () => ({})) : ex.sets
    for (const [s, set] of sets.entries()) {
      await addRoutineSet({
        routineExerciseId: re.id,
        order: s,
        type: set.type ?? 'normal',
        targetRepsMin: set.reps ?? null,
        targetRepsMax: set.reps ?? null,
        targetWeight: set.weight ?? null,
        targetDurationSec: set.durationSec ?? null,
      })
    }
  }
  return r
}

/** A finished session with completed sets per exercise. */
export async function seedSession(input: {
  routineId: Id | null
  name: string
  startedAt: string
  exercises: { exerciseId: Id; sets: SeedSet[] }[]
}) {
  const w = await startWorkout({ routineId: input.routineId, name: input.name, startedAt: input.startedAt })
  const endedAt = new Date(Date.parse(input.startedAt) + 3_600_000).toISOString()
  await updateWorkout(w.id, { status: 'finished', endedAt })
  for (const [i, ex] of input.exercises.entries()) {
    const we = await addWorkoutExercise({
      workoutId: w.id,
      exerciseId: ex.exerciseId,
      routineExerciseId: null,
      restSec: null,
      order: i,
      note: '',
      supersetGroup: null,
    })
    for (const [s, set] of ex.sets.entries()) {
      await addWorkoutSet({
        workoutExerciseId: we.id,
        order: s,
        type: set.type ?? 'normal',
        weight: set.weight ?? null,
        reps: set.reps ?? null,
        durationSec: set.durationSec ?? null,
        rpe: null,
        completed: true,
        completedAt: endedAt,
      })
    }
  }
  return w
}

function ExerciseStub() {
  const { exerciseId } = useParams()
  return <h1>Ejercicio {exerciseId}</h1>
}

/** Renders the global layer and mini-player as AppLayout does, plus a V11 stub. */
export function renderWorkoutUi(path = '/') {
  const { Layer, MiniPlayer } = activeWorkoutUi
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <>
            <Layer />
            <MiniPlayer />
          </>
        ),
      },
      { path: '/progreso/ejercicios/:exerciseId', element: <ExerciseStub /> },
    ],
    { initialEntries: [path] },
  )
  return { ...render(<RouterProvider router={router} />), router }
}
