import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Id } from '@training-log/domain'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listLive } from '../../data/repositories/base'
import { listRoutineExercises, listRoutineSets } from '../../data/repositories/routines'
import { getWorkout, listWorkoutExercises, listWorkoutSets } from '../../data/repositories/workouts'
import { resetDb } from '../../data/testUtils'
import { renderHistory } from '../history/test-helpers'
import { onStartRoutine } from '../routines/start-workout'
import { renderWorkoutUi, seedRoutine, seedSession, stubCatalog } from '../workout/test-helpers'
import { getWorkoutUi, resetWorkoutUi } from '../workout/ui-store'
import { addExercises, addSet, completeSet, saveSet } from '../workout/workout-actions'

beforeEach(async () => {
  await resetDb()
  stubCatalog()
  resetWorkoutUi()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** Completes every row of every exercise of the workout with the given values. */
async function completeAll(workoutId: Id, values: { weight?: number; reps?: number }[]) {
  for (const we of await listWorkoutExercises(workoutId)) {
    for (const [i, s] of (await listWorkoutSets(we.id)).entries()) {
      const v = values[i] ?? values.at(-1)!
      await completeSet({
        workoutId,
        setId: s.id,
        values: { weight: v.weight ?? null, reps: v.reps ?? null, durationSec: null },
        restSec: 0,
      })
    }
  }
}

/** Starts the routine (or a free workout), lets `prepare` log sets, renders V5 and taps FINALIZAR. */
async function openFinish(routineId: Id | null, prepare: (workoutId: Id) => Promise<void>) {
  const user = userEvent.setup()
  const w = await act(() => onStartRoutine(routineId))
  await act(() => prepare(w.id))
  renderWorkoutUi()
  const v5 = await screen.findByRole('dialog', { name: 'Entreno activo' })
  await user.click(within(v5).getByRole('button', { name: 'Finalizar' }))
  const v7 = await screen.findByRole('dialog', { name: 'Finalizar entreno' })
  return { user, workoutId: w.id, v7 }
}

async function routineSets(routineId: Id) {
  const [re] = await listRoutineExercises(routineId)
  return listRoutineSets(re!.id)
}

describe('V7 · Finalizar entreno', () => {
  it('F3: after adding a set and lifting 82.5 kg against an 80 kg target, lists both changes and "Sí" updates the routine', async () => {
    const push = await seedRoutine({
      name: 'Push',
      exercises: [{ exerciseId: 'ex-banca', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }] }],
    })
    const { user, workoutId, v7 } = await openFinish(push.id, async (id) => {
      const [we] = await listWorkoutExercises(id)
      await addSet(we!.id)
      await completeAll(id, [{ weight: 82.5, reps: 8 }, { weight: 80, reps: 8 }, { weight: 82.5, reps: 8 }])
    })

    // Summary: 82,5×8 + 80×8 + 82,5×8 = 1960 kg in 3 sets and 24 reps.
    const summary = within(v7).getByRole('region', { name: 'Resumen' })
    await waitFor(() => expect(summary).toHaveTextContent('1960 kg'))
    expect(within(summary).getByText('Series').nextSibling).toHaveTextContent('3')
    expect(within(summary).getByText('Reps').nextSibling).toHaveTextContent('24')

    const changes = await within(v7).findByRole('region', { name: '¿Actualizar la rutina?' })
    expect(within(changes).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Press banca: serie 1 de 80 a 82,5 kg',
      'Press banca: añadir serie 3',
    ])

    await user.click(within(changes).getByRole('radio', { name: 'Sí' }))
    await user.click(within(v7).getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByRole('dialog', { name: 'Entreno guardado' })).toBeInTheDocument()
    const sets = await routineSets(push.id)
    expect(sets.map((s) => s.targetWeight)).toEqual([82.5, 80, 82.5])
    expect(sets.map((s) => s.targetRepsMax)).toEqual([8, 8, 8])
    expect(await getWorkout(workoutId)).toMatchObject({ status: 'finished' })
  })

  it('"Solo esta vez" leaves the routine unchanged', async () => {
    const push = await seedRoutine({
      name: 'Push',
      exercises: [{ exerciseId: 'ex-banca', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }] }],
    })
    const { user, workoutId, v7 } = await openFinish(push.id, (id) => completeAll(id, [{ weight: 82.5, reps: 8 }]))

    const changes = await within(v7).findByRole('region', { name: '¿Actualizar la rutina?' })
    await user.click(within(changes).getByRole('radio', { name: 'Solo esta vez' }))
    await user.click(within(v7).getByRole('button', { name: 'Guardar' }))

    await screen.findByRole('dialog', { name: 'Entreno guardado' })
    expect((await routineSets(push.id)).map((s) => s.targetWeight)).toEqual([80, 80])
    expect(await getWorkout(workoutId)).toMatchObject({ status: 'finished' })
  })

  it('with no changes, the update question does not appear', async () => {
    const push = await seedRoutine({
      name: 'Push',
      exercises: [{ exerciseId: 'ex-banca', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }] }],
    })
    const { v7 } = await openFinish(push.id, (id) => completeAll(id, [{ weight: 80, reps: 8 }]))

    await waitFor(() => expect(within(v7).getByRole('region', { name: 'Resumen' })).toHaveTextContent('1280 kg'))
    expect(within(v7).queryByRole('region', { name: '¿Actualizar la rutina?' })).not.toBeInTheDocument()
    expect(within(v7).queryByRole('button', { name: 'Guardar como rutina nueva' })).not.toBeInTheDocument()
  })

  it('stores energy, tags and note; shows the read-only RPE average and the comparison with the last session', async () => {
    const push = await seedRoutine({ name: 'Push', exercises: [{ exerciseId: 'ex-banca', sets: [{ weight: 100, reps: 10 }] }] })
    // Last time: 1000 kg in 60 minutes.
    await seedSession({
      routineId: push.id,
      name: 'Push',
      startedAt: '2026-11-12T18:00:00.000Z',
      exercises: [{ exerciseId: 'ex-banca', sets: [{ weight: 100, reps: 10 }] }],
    })
    const { user, workoutId, v7 } = await openFinish(push.id, async (id) => {
      await completeAll(id, [{ weight: 105, reps: 10 }])
      const [we] = await listWorkoutExercises(id)
      const [s] = await listWorkoutSets(we!.id)
      await saveSet(s!.id, { rpe: 8 })
    })

    // 1050 kg vs 1000 kg.
    await waitFor(() => expect(within(v7).getByRole('region', { name: 'Resumen' })).toHaveTextContent('+5 %'))
    expect(within(v7).getByText('RPE medio').nextSibling).toHaveTextContent('8')

    await user.click(within(v7).getByRole('radio', { name: 'Energía 4 de 5' }))
    await user.click(within(v7).getByRole('button', { name: 'Gran pump' }))
    await user.type(within(v7).getByRole('textbox', { name: 'Nota' }), 'Buen día')
    await user.click(within(v7).getByRole('radio', { name: 'Solo esta vez' }))
    await user.click(within(v7).getByRole('button', { name: 'Guardar' }))

    await screen.findByRole('dialog', { name: 'Entreno guardado' })
    expect(await getWorkout(workoutId)).toMatchObject({ energy: 4, tags: ['Gran pump'], note: 'Buen día' })
  })

  it('a free workout shows "Guardar como rutina nueva", and saving it creates a routine with the performed exercises and sets', async () => {
    const { user, workoutId, v7 } = await openFinish(null, async (id) => {
      await addExercises(id, ['ex-remo', 'ex-banca'])
      await completeAll(id, [{ weight: 60, reps: 10 }])
      const [, banca] = await listWorkoutExercises(id)
      await addSet(banca!.id)
      const sets = await listWorkoutSets(banca!.id)
      await completeSet({ workoutId: id, setId: sets[1]!.id, values: { weight: 70, reps: 6, durationSec: null }, restSec: 0 })
    })

    expect(within(v7).queryByRole('region', { name: '¿Actualizar la rutina?' })).not.toBeInTheDocument()
    await user.click(within(v7).getByRole('button', { name: 'Guardar como rutina nueva' }))
    await user.type(within(v7).getByRole('textbox', { name: 'Nombre de la rutina' }), 'Espalda y pecho')
    await user.click(within(v7).getByRole('button', { name: 'Guardar' }))
    await screen.findByRole('dialog', { name: 'Entreno guardado' })

    const routines = await listLive('routines')
    expect(routines.map((r) => r.name)).toEqual(['Espalda y pecho'])
    const exercises = await listRoutineExercises(routines[0]!.id)
    expect(exercises.map((e) => e.exerciseId)).toEqual(['ex-remo', 'ex-banca'])
    const bancaSets = await listRoutineSets(exercises[1]!.id)
    expect(bancaSets.map((s) => [s.targetWeight, s.targetRepsMax])).toEqual([
      [60, 10],
      [70, 6],
    ])
    expect(await getWorkout(workoutId)).toMatchObject({ status: 'finished', routineId: routines[0]!.id })
  })

  it('discarding asks for confirmation and marks the workout discarded so it never appears in history', async () => {
    const push = await seedRoutine({ name: 'Push', exercises: [{ exerciseId: 'ex-banca', sets: 1 }] })
    const { user, workoutId, v7 } = await openFinish(push.id, (id) => completeAll(id, [{ weight: 80, reps: 8 }]))

    await user.click(within(v7).getByRole('button', { name: 'Descartar' }))
    const confirm = await screen.findByRole('alertdialog', { name: '¿Descartar entreno?' })
    await user.click(within(confirm).getByRole('button', { name: 'Descartar' }))

    await waitFor(async () => expect(await getWorkout(workoutId)).toMatchObject({ status: 'discarded' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Finalizar entreno' })).not.toBeInTheDocument())
    expect(getWorkoutUi()).toMatchObject({ expanded: false, finishing: false })

    cleanup()
    renderHistory()
    expect(await screen.findByText(/Sin entrenos en/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Push/ })).not.toBeInTheDocument()
  })

  it('"Volver al entreno" goes back to V5 without saving', async () => {
    const push = await seedRoutine({ name: 'Push', exercises: [{ exerciseId: 'ex-banca', sets: 1 }] })
    const { user, workoutId, v7 } = await openFinish(push.id, (id) => completeAll(id, [{ weight: 80, reps: 8 }]))

    await user.click(within(v7).getByRole('button', { name: 'Volver al entreno' }))

    expect(await screen.findByRole('dialog', { name: 'Entreno activo' })).toBeInTheDocument()
    expect(await getWorkout(workoutId)).toMatchObject({ status: 'active' })
  })
})
