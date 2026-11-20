import { render } from '@testing-library/react'
import type { Id, MuscleId, SetType, TrackingType } from '@training-log/domain'
import { createMemoryRouter, RouterProvider, useParams } from 'react-router'
import { vi } from 'vitest'
import { createRoutine } from '../../data/repositories/routines'
import {
  addWorkoutExercise,
  addWorkoutSet,
  startWorkout,
  updateWorkout,
} from '../../data/repositories/workouts'
import { resetCatalogCache, type CatalogEntry } from '../exercises/catalog'
import { progressRoutes } from './routes'

function entry(
  id: string,
  name: string,
  trackingType: TrackingType,
  primaryMuscle: MuscleId,
  secondaryMuscles: MuscleId[] = [],
): CatalogEntry {
  return {
    id,
    name,
    nameEn: name,
    primaryMuscle,
    secondaryMuscles,
    equipment: 'barbell',
    trackingType,
    imageUrl: null,
    mediaId: id,
    instructionsEs: [],
  }
}

export const CATALOG: CatalogEntry[] = [
  entry('ex-banca', 'Press banca', 'weight_reps', 'chest', ['triceps']),
  entry('ex-remo', 'Remo con barra', 'weight_reps', 'middle_back', ['biceps']),
  entry('ex-sentadilla', 'Sentadilla', 'weight_reps', 'quadriceps', ['glutes']),
  entry('ex-militar', 'Press militar', 'weight_reps', 'shoulders'),
  entry('ex-curl', 'Curl de bíceps', 'weight_reps', 'biceps'),
  entry('ex-peso-muerto', 'Peso muerto', 'weight_reps', 'hamstrings'),
  entry('ex-fondos', 'Fondos en paralelas', 'reps', 'triceps'),
  entry('ex-plancha', 'Plancha', 'time', 'abdominals'),
]

/** Serves the catalog fixture instead of the real JSON. */
export function stubCatalog() {
  resetCatalogCache()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(CATALOG), { status: 200 })),
  )
}

/** jsdom has no ResizeObserver; Recharts' ResponsiveContainer needs one. */
export function stubResizeObserver() {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
}

/** Freezes "today" (only Date is faked, so Dexie and user-event keep real timers). */
export function freezeToday(iso = '2026-11-20T12:00:00.000Z') {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(iso))
}

export interface SeedSet {
  weight?: number | null
  reps?: number | null
  durationSec?: number | null
  rpe?: number | null
  type?: SetType
}

/** A finished session with completed sets per exercise. */
export async function seedSession(input: {
  routineId?: Id | null
  name?: string
  startedAt: string
  minutes?: number
  energy?: number | null
  exercises: { exerciseId: Id; sets: SeedSet[] }[]
}) {
  const w = await startWorkout({
    routineId: input.routineId ?? null,
    name: input.name ?? 'Entreno libre',
    startedAt: input.startedAt,
  })
  const endedAt = new Date(
    Date.parse(input.startedAt) + (input.minutes ?? 60) * 60_000,
  ).toISOString()
  await updateWorkout(w.id, { status: 'finished', endedAt, energy: input.energy ?? null })
  for (const [i, ex] of input.exercises.entries()) {
    const we = await addWorkoutExercise({
      workoutId: w.id,
      exerciseId: ex.exerciseId,
      routineExerciseId: null,
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
        rpe: set.rpe ?? null,
        completed: true,
        completedAt: endedAt,
      })
    }
  }
  return w
}

export const seedRoutine = (name: string) => createRoutine({ name, folderId: null })

function SessionStub() {
  const { workoutId } = useParams()
  return <h1>Sesión {workoutId}</h1>
}

/** Renders the Progreso tab routes as the app mounts them (`/progreso/...`), plus a V8 stub. */
export function renderProgress(path = '/progreso') {
  const router = createMemoryRouter(
    [
      { path: '/progreso', children: progressRoutes },
      { path: '/historial/sesiones/:workoutId', element: <SessionStub /> },
    ],
    { initialEntries: [path] },
  )
  return { ...render(<RouterProvider router={router} />), router }
}
