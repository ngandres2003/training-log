import { render } from '@testing-library/react'
import type { Id } from '@training-log/domain'
import { createMemoryRouter, RouterProvider, useParams } from 'react-router'
import {
  addWorkoutExercise,
  addWorkoutSet,
  startWorkout,
  updateWorkout,
} from '../../data/repositories/workouts'
import { historyRoutes } from './routes'

function SessionStub() {
  const { workoutId } = useParams()
  return <h1>Sesión {workoutId}</h1>
}

/** Renders the Historial tab routes (plus a V8 stub) at `path`. */
export function renderHistory(path = '/historial') {
  const router = createMemoryRouter(
    [
      { path: '/historial', children: historyRoutes },
      { path: '/historial/sesiones/:workoutId', element: <SessionStub /> },
    ],
    { initialEntries: [path] },
  )
  return { ...render(<RouterProvider router={router} />), router }
}

/**
 * A finished workout (what U14's V7 saves) with `sets` completed working sets of one exercise.
 * `startedAt` defaults to noon UTC of `day`, so the local day is the same in any common time zone.
 */
export async function seedSession(input: {
  day: string
  name: string
  routineId?: Id | null
  sets?: number
}) {
  const startedAt = `${input.day}T12:00:00.000Z`
  const w = await startWorkout({ routineId: input.routineId ?? null, name: input.name, startedAt })
  const endedAt = new Date(Date.parse(startedAt) + 45 * 60_000).toISOString()
  await updateWorkout(w.id, { status: 'finished', endedAt })
  const we = await addWorkoutExercise({
    workoutId: w.id,
    exerciseId: 'cat-banca',
    routineExerciseId: null,
    order: 0,
    note: '',
    supersetGroup: null,
  })
  for (let i = 0; i < (input.sets ?? 3); i++) {
    await addWorkoutSet({
      workoutExerciseId: we.id,
      order: i,
      type: 'normal',
      weight: 60,
      reps: 8,
      durationSec: null,
      rpe: null,
      completed: true,
      completedAt: endedAt,
    })
  }
  return w
}
