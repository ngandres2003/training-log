import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { exerciseSessions, personalRecords } from '@training-log/domain'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listLive } from '../../data/repositories/base'
import { deleteRoutine } from '../../data/repositories/routines'
import {
  getActiveWorkout,
  getWorkout,
  listWorkoutExercises,
  listWorkoutSets,
  updateWorkout,
} from '../../data/repositories/workouts'
import { resetDb } from '../../data/testUtils'
import { seedRoutine, seedSession, stubCatalog } from '../workout/test-helpers'
import { getWorkoutUi, resetWorkoutUi } from '../workout/ui-store'
import { renderSessions } from './test-helpers'

beforeEach(async () => {
  await resetDb()
  stubCatalog()
  resetWorkoutUi()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** Marks of the exercise derived from the finished sessions in Dexie (what V11 reads, KTD7). */
async function benchRecords() {
  const tables = {
    workouts: await listLive('workouts'),
    workoutExercises: await listLive('workoutExercises'),
    workoutSets: await listLive('workoutSets'),
  }
  return personalRecords(exerciseSessions('ex-banca', tables), 'weight_reps')
}

describe('V8 · Detalle de sesión', () => {
  it('shows the read-only summary, sensations, note and each exercise with its sets', async () => {
    const push = await seedRoutine({ name: 'Push', exercises: [{ exerciseId: 'ex-banca', sets: 2 }] })
    const w = await seedSession({
      routineId: push.id,
      name: 'Push',
      startedAt: '2026-11-12T18:00:00.000Z',
      exercises: [
        {
          exerciseId: 'ex-banca',
          sets: [
            { weight: 80, reps: 8 },
            { weight: 85, reps: 6 },
          ],
        },
      ],
    })
    await updateWorkout(w.id, { energy: 4, tags: ['Gran pump'], note: 'Buen día' })

    renderSessions(`/historial/sesiones/${w.id}`)

    expect(await screen.findByRole('heading', { level: 1, name: 'Push' })).toBeInTheDocument()
    const summary = screen.getByRole('region', { name: 'Resumen' })
    await waitFor(() => expect(summary).toHaveTextContent('1150 kg'))
    expect(within(summary).getByText('Duración').nextSibling).toHaveTextContent('60 min')
    expect(screen.getByText('Energía').nextSibling).toHaveTextContent('4/5')
    expect(screen.getByText('Gran pump')).toBeInTheDocument()
    expect(screen.getByText('Buen día')).toBeInTheDocument()
    const bench = screen.getByRole('region', { name: 'Press banca' })
    const rows = within(bench).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('80 kg × 8')
    expect(rows[1]).toHaveTextContent('85 kg × 6')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('editing a past session’s weight downwards removes a PR that depended on it from the records', async () => {
    const user = userEvent.setup()
    await seedSession({
      routineId: null,
      name: 'Entreno libre',
      startedAt: '2026-11-10T18:00:00.000Z',
      exercises: [{ exerciseId: 'ex-banca', sets: [{ weight: 100, reps: 5 }] }],
    })
    const w = await seedSession({
      routineId: null,
      name: 'Entreno libre',
      startedAt: '2026-11-12T18:00:00.000Z',
      exercises: [{ exerciseId: 'ex-banca', sets: [{ weight: 105, reps: 5 }] }],
    })
    expect((await benchRecords())?.maxWeight).toBe(105)

    renderSessions(`/historial/sesiones/${w.id}`)
    const bench = await screen.findByRole('region', { name: 'Press banca' })
    // 105 kg beat the 100 kg of the first session.
    await waitFor(() => expect(within(bench).getByText('PR')).toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: 'Editar' }))
    const weight = await screen.findByRole('textbox', { name: 'kg fila 1' })
    await waitFor(() => expect(weight).toHaveValue('105'))
    await user.clear(weight)
    await user.type(weight, '95')
    await user.tab()

    await waitFor(async () => expect((await benchRecords())?.maxWeight).toBe(100))
    await user.click(screen.getByRole('link', { name: 'Listo' }))
    const benchAfter = await screen.findByRole('region', { name: 'Press banca' })
    await waitFor(() => expect(benchAfter).toHaveTextContent('95 kg × 5'))
    expect(within(benchAfter).queryByText('PR')).not.toBeInTheDocument()
  })

  it('a session from a deleted routine shows "(eliminada)", and "Repetir" starts a free workout with the same exercises', async () => {
    const user = userEvent.setup()
    const legs = await seedRoutine({
      name: 'Pierna B',
      exercises: [
        { exerciseId: 'ex-sentadilla', sets: 2 },
        { exerciseId: 'ex-plancha', sets: 1 },
      ],
    })
    const w = await seedSession({
      routineId: legs.id,
      name: 'Pierna B',
      startedAt: '2026-11-12T18:00:00.000Z',
      exercises: [
        { exerciseId: 'ex-sentadilla', sets: [{ weight: 100, reps: 5 }, { weight: 100, reps: 5 }, { weight: 100, reps: 5 }] },
        { exerciseId: 'ex-plancha', sets: [{ durationSec: 60 }] },
      ],
    })
    await deleteRoutine(legs.id)

    renderSessions(`/historial/sesiones/${w.id}`)

    expect(await screen.findByRole('heading', { level: 1, name: 'Pierna B (eliminada)' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Repetir' }))

    await waitFor(async () => expect(await getActiveWorkout()).toBeDefined())
    const active = (await getActiveWorkout())!
    expect(active.routineId).toBeNull()
    const exercises = await listWorkoutExercises(active.id)
    expect(exercises.map((e) => e.exerciseId)).toEqual(['ex-sentadilla', 'ex-plancha'])
    expect((await listWorkoutSets(exercises[0]!.id)).length).toBe(3)
    expect(getWorkoutUi().expanded).toBe(true)
  })

  it('"Repetir" on a live routine starts that routine', async () => {
    const user = userEvent.setup()
    const push = await seedRoutine({ name: 'Push', exercises: [{ exerciseId: 'ex-banca', sets: 2 }] })
    const w = await seedSession({
      routineId: push.id,
      name: 'Push',
      startedAt: '2026-11-12T18:00:00.000Z',
      exercises: [{ exerciseId: 'ex-banca', sets: [{ weight: 80, reps: 8 }] }],
    })

    renderSessions(`/historial/sesiones/${w.id}`)
    await user.click(await screen.findByRole('button', { name: 'Repetir' }))

    await waitFor(async () => expect((await getActiveWorkout())?.routineId).toBe(push.id))
  })

  it('deleting asks for confirmation, tombstones the session and returns to Historial', async () => {
    const user = userEvent.setup()
    const w = await seedSession({
      routineId: null,
      name: 'Entreno libre',
      startedAt: '2026-11-12T18:00:00.000Z',
      exercises: [{ exerciseId: 'ex-banca', sets: [{ weight: 80, reps: 8 }] }],
    })

    renderSessions(`/historial/sesiones/${w.id}`)
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }))
    const confirm = await screen.findByRole('alertdialog', { name: '¿Eliminar sesión?' })
    await user.click(within(confirm).getByRole('button', { name: 'Eliminar' }))

    expect(await screen.findByRole('heading', { name: 'Historial' })).toBeInTheDocument()
    expect(await getWorkout(w.id)).toBeUndefined()
    expect(await benchRecords()).toBeNull()
  })
})
