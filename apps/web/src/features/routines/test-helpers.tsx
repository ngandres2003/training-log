import { render } from '@testing-library/react'
import type { Id, TrackingType } from '@training-log/domain'
import { createMemoryRouter, RouterProvider, useParams } from 'react-router'
import { vi } from 'vitest'
import { addRoutineExercise, addRoutineSet, createRoutine } from '../../data/repositories/routines'
import { addWorkoutExercise, addWorkoutSet, startWorkout, updateWorkout } from '../../data/repositories/workouts'
import { resetCatalogCache, type CatalogEntry } from '../exercises/catalog'
import { routinesRoutes } from './routes'

function entry(id: string, name: string, trackingType: TrackingType): CatalogEntry {
  return {
    id,
    name,
    nameEn: name,
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'other',
    trackingType,
    imageUrl: null,
    mediaId: id,
    instructionsEs: [],
  }
}

export const CATALOG: CatalogEntry[] = [
  entry('cat-banca', 'Press banca', 'weight_reps'),
  entry('cat-dominadas', 'Dominadas', 'reps'),
  entry('cat-plancha', 'Plancha', 'time'),
  entry('cat-sentadilla', 'Sentadilla', 'weight_reps'),
]

/** Serves the tiny catalog fixture instead of the real JSON. */
export function stubCatalog() {
  resetCatalogCache()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(CATALOG), { status: 200 })),
  )
}

function SessionStub() {
  const { workoutId } = useParams()
  return <h1>Sesión {workoutId}</h1>
}

/** Renders the Inicio tab routes (plus a V8 stub) at `path`. */
export function renderRoutines(path = '/') {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        children: [...routinesRoutes, { path: 'historial/sesiones/:workoutId', element: <SessionStub /> }],
      },
    ],
    { initialEntries: [path] },
  )
  return { ...render(<RouterProvider router={router} />), router }
}

/** A finished workout of a routine, with one exercise and its completed sets. */
export async function seedFinishedWorkout(input: {
  routineId: Id | null
  name: string
  startedAt: string
  minutes?: number
  energy?: number | null
  note?: string
  exerciseId?: Id
  sets?: { weight: number | null; reps: number | null; rpe?: number | null }[]
}) {
  const w = await startWorkout({ routineId: input.routineId, name: input.name, startedAt: input.startedAt })
  const endedAt = new Date(Date.parse(input.startedAt) + (input.minutes ?? 60) * 60_000).toISOString()
  await updateWorkout(w.id, {
    status: 'finished',
    endedAt,
    energy: input.energy ?? null,
    note: input.note ?? '',
  })
  if (input.sets) {
    const we = await addWorkoutExercise({
      workoutId: w.id,
      exerciseId: input.exerciseId ?? 'cat-banca',
      routineExerciseId: null,
      order: 0,
      note: '',
      supersetGroup: null,
    })
    for (const [i, s] of input.sets.entries()) {
      await addWorkoutSet({
        workoutExerciseId: we.id,
        order: i,
        type: 'normal',
        weight: s.weight,
        reps: s.reps,
        durationSec: null,
        rpe: s.rpe ?? null,
        completed: true,
        completedAt: endedAt,
      })
    }
  }
  return w
}

/** A routine with exercises, each with `sets` normal target sets. */
export async function seedRoutine(input: {
  name: string
  folderId?: Id | null
  order?: number
  exercises?: { exerciseId: Id; sets: number; repsMin?: number; repsMax?: number; weight?: number | null }[]
}) {
  const r = await createRoutine({ name: input.name, folderId: input.folderId ?? null, order: input.order })
  for (const [i, ex] of (input.exercises ?? []).entries()) {
    const re = await addRoutineExercise({ routineId: r.id, exerciseId: ex.exerciseId, order: i })
    for (let s = 0; s < ex.sets; s++) {
      await addRoutineSet({
        routineExerciseId: re.id,
        order: s,
        type: 'normal',
        targetRepsMin: ex.repsMin ?? 8,
        targetRepsMax: ex.repsMax ?? 12,
        targetWeight: ex.weight ?? null,
        targetDurationSec: null,
      })
    }
  }
  return r
}
