import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveSettings } from '../../data/repositories/settings'
import {
  getActiveWorkout,
  getWorkout,
  listWorkoutExercises,
  listWorkoutSets,
  updateWorkout,
} from '../../data/repositories/workouts'
import { resetDb } from '../../data/testUtils'
import { onStartRoutine } from '../routines/start-workout'
import { renderWorkoutUi, seedRoutine, seedSession, stubCatalog } from './test-helpers'
import { resetWorkoutUi } from './ui-store'
import { completeSet } from './workout-actions'

beforeEach(async () => {
  await resetDb()
  stubCatalog()
  resetWorkoutUi()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** Starts (or resumes) like V1's ▶ Iniciar and renders the layer; resolves with V5. */
async function startAndOpen(routineId: string | null) {
  await act(() => onStartRoutine(routineId))
  const view = renderWorkoutUi()
  const v5 = await screen.findByRole('dialog', { name: 'Entreno activo' })
  return { ...view, v5 }
}

const row = (name: string) => screen.getByRole('row', { name })

async function setsOf(exerciseIndex = 0) {
  const w = await getActiveWorkout()
  const exercises = await listWorkoutExercises(w!.id)
  return listWorkoutSets(exercises[exerciseIndex]!.id)
}

describe('V5 · Anterior and prefill (R18)', () => {
  it('AE1: with 4 rows last time and 6 today, rows 5–6 show "—" and are prefilled from row 4', async () => {
    const push = await seedRoutine({ name: 'Push', exercises: [{ exerciseId: 'ex-banca', sets: 6 }] })
    await seedSession({
      routineId: push.id,
      name: 'Push',
      startedAt: '2026-11-12T18:00:00.000Z',
      exercises: [
        {
          exerciseId: 'ex-banca',
          sets: [
            { weight: 80, reps: 10 },
            { weight: 85, reps: 8 },
            { weight: 90, reps: 6 },
            { weight: 100, reps: 5 },
          ],
        },
      ],
    })

    await startAndOpen(push.id)

    await waitFor(() => expect(row('Fila 1')).toHaveTextContent('80 × 10'))
    expect(row('Fila 4')).toHaveTextContent('100 × 5')
    for (const n of [5, 6]) {
      expect(within(row(`Fila ${n}`)).getByText('—')).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: `kg fila ${n}` })).toHaveAttribute('placeholder', '100')
      expect(screen.getByRole('textbox', { name: `Reps fila ${n}` })).toHaveAttribute('placeholder', '5')
    }
    // RPE is never prefilled (R21).
    expect(screen.getByRole('textbox', { name: 'RPE fila 1' })).toHaveAttribute('placeholder', '')
  })

  it('AE2: an extra warm-up in row 2 shows and preloads row 2 of last time, a working set', async () => {
    const push = await seedRoutine({
      name: 'Push',
      exercises: [{ exerciseId: 'ex-banca', sets: [{}, { type: 'warmup' }, {}, {}] }],
    })
    await seedSession({
      routineId: push.id,
      name: 'Push',
      startedAt: '2026-11-12T18:00:00.000Z',
      exercises: [
        {
          exerciseId: 'ex-banca',
          sets: [
            { weight: 100, reps: 5 },
            { weight: 102.5, reps: 5 },
            { weight: 105, reps: 3 },
          ],
        },
      ],
    })

    await startAndOpen(push.id)

    await waitFor(() => expect(row('Fila 2')).toHaveTextContent('102,5 × 5'))
    expect(within(row('Fila 2')).getByText('C')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'kg fila 2' })).toHaveAttribute('placeholder', '102,5')
  })

  it('confirming a prefilled row takes one tap and stores the prefilled values', async () => {
    const user = userEvent.setup()
    const push = await seedRoutine({ name: 'Push', exercises: [{ exerciseId: 'ex-banca', sets: 2 }] })
    await seedSession({
      routineId: push.id,
      name: 'Push',
      startedAt: '2026-11-12T18:00:00.000Z',
      exercises: [{ exerciseId: 'ex-banca', sets: [{ weight: 100, reps: 5 }] }],
    })
    await startAndOpen(push.id)
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'kg fila 1' })).toHaveAttribute('placeholder', '100'))

    await user.click(screen.getByRole('button', { name: 'Completar fila 1' }))

    await waitFor(async () =>
      expect((await setsOf())[0]).toMatchObject({ weight: 100, reps: 5, rpe: null, completed: true }),
    )
  })

  it('"Añadir serie" appends a row prefilled per R18, and "Eliminar serie" in the row menu removes one', async () => {
    const user = userEvent.setup()
    const push = await seedRoutine({ name: 'Push', exercises: [{ exerciseId: 'ex-banca', sets: 2 }] })
    await seedSession({
      routineId: push.id,
      name: 'Push',
      startedAt: '2026-11-12T18:00:00.000Z',
      exercises: [
        {
          exerciseId: 'ex-banca',
          sets: [
            { weight: 100, reps: 5 },
            { weight: 105, reps: 3 },
          ],
        },
      ],
    })
    await startAndOpen(push.id)
    await screen.findByRole('row', { name: 'Fila 2' })

    await user.click(screen.getByRole('button', { name: 'Añadir serie' }))
    const added = await screen.findByRole('row', { name: 'Fila 3' })
    expect(within(added).getByText('—')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'kg fila 3' })).toHaveAttribute('placeholder', '105'),
    )
    expect(await setsOf()).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: 'Opciones de la fila 1' }))
    await user.click(screen.getByRole('menuitem', { name: 'Eliminar serie' }))
    await waitFor(async () => expect(await setsOf()).toHaveLength(2))
    await waitFor(() => expect(screen.queryByRole('row', { name: 'Fila 3' })).not.toBeInTheDocument())
  })
})

describe('V5 · chip "En otra rutina" (R19)', () => {
  it('AE8: no chip when the exercise has no history outside the routine', async () => {
    const push = await seedRoutine({ name: 'Push', exercises: [{ exerciseId: 'ex-banca', sets: 1 }] })
    await seedSession({
      routineId: push.id,
      name: 'Push',
      startedAt: '2026-11-12T18:00:00.000Z',
      exercises: [{ exerciseId: 'ex-banca', sets: [{ weight: 100, reps: 5 }] }],
    })
    await startAndOpen(push.id)
    await waitFor(() => expect(row('Fila 1')).toHaveTextContent('100 × 5'))
    expect(screen.queryByRole('button', { name: /En otra rutina/ })).not.toBeInTheDocument()
  })

  it('shows the most recent session outside the routine and expands to the best mark and the V11 link', async () => {
    const user = userEvent.setup()
    const legs = await seedRoutine({ name: 'Pierna A', exercises: [{ exerciseId: 'ex-sentadilla', sets: 1 }] })
    await seedSession({
      routineId: null,
      name: 'Full body',
      startedAt: '2026-11-03T18:00:00.000Z',
      exercises: [{ exerciseId: 'ex-sentadilla', sets: [{ weight: 90, reps: 5 }] }],
    })
    await seedSession({
      routineId: 'otra-rutina',
      name: 'Pierna B',
      startedAt: '2026-11-12T18:00:00.000Z',
      exercises: [{ exerciseId: 'ex-sentadilla', sets: [{ weight: 80, reps: 8 }] }],
    })
    await startAndOpen(legs.id)

    const chip = await screen.findByRole('button', { name: /En otra rutina/ })
    expect(chip).toHaveTextContent('Pierna B · 12 nov · 80 kg × 8')
    expect(chip).toHaveAttribute('aria-expanded', 'false')

    await user.click(chip)
    expect(chip).toHaveAttribute('aria-expanded', 'true')
    const panel = screen.getByRole('region', { name: 'En otra rutina' })
    expect(panel).toHaveTextContent('Más reciente')
    expect(panel).toHaveTextContent('Pierna B · 12 nov · 80 kg × 8')
    expect(panel).toHaveTextContent('Mejor marca')
    expect(panel).toHaveTextContent('Full body · 3 nov · 90 kg × 5')
    expect(panel).toHaveTextContent('e1RM 105 kg')
    expect(within(panel).getByRole('link', { name: 'Ver historial' })).toHaveAttribute(
      'href',
      '/progreso/ejercicios/ex-sentadilla',
    )
  })
})

describe('V5 · ✓, rest and PRs', () => {
  it('AE6: ✓ on A1 starts A’s rest and V6 shows B1 next', async () => {
    const user = userEvent.setup()
    const upper = await seedRoutine({
      name: 'Upper A',
      exercises: [
        { exerciseId: 'ex-banca', sets: [{ weight: 80, reps: 8 }, {}, {}], restSec: 90, supersetGroup: 'ss' },
        { exerciseId: 'ex-remo', sets: [{ weight: 70, reps: 10 }, {}, {}], restSec: 60, supersetGroup: 'ss' },
      ],
    })
    await startAndOpen(upper.id)
    // One slide with rows in alternation order.
    const slide = await screen.findByRole('group', { name: /Superserie/ })
    expect(within(slide).getAllByRole('row', { name: /^Fila/ }).map((r) => r.getAttribute('aria-label'))).toEqual([
      'Fila A1',
      'Fila B1',
      'Fila A2',
      'Fila B2',
      'Fila A3',
      'Fila B3',
    ])

    await user.click(screen.getByRole('button', { name: 'Completar fila A1' }))

    const rest = await screen.findByRole('dialog', { name: 'Descanso' })
    const next = within(rest).getByRole('region', { name: /Siguiente/ })
    expect(next).toHaveTextContent('B1, ronda 1 de 3')
    expect(next).toHaveTextContent('Remo con barra')
    expect(next).toHaveTextContent('70 kg × 10')
    const w = await getActiveWorkout()
    const [a1] = await setsOf(0)
    expect(Date.parse(w!.restEndsAt!) - Date.parse(a1!.completedAt!)).toBe(90_000)
  })

  it('AE4: no PR badge in the first session; a heavier set next session shows one', async () => {
    const user = userEvent.setup()
    const legs = await seedRoutine({
      name: 'Pierna',
      exercises: [{ exerciseId: 'ex-sentadilla', sets: [{ weight: 100, reps: 5 }], restSec: 0 }],
    })
    await startAndOpen(legs.id)
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'kg fila 1' })).toHaveAttribute('placeholder', '100'))
    await user.click(screen.getByRole('button', { name: 'Completar fila 1' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Completar fila 1' })).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.queryByText('PR')).not.toBeInTheDocument()

    // Finish the first session (V7 is U14) and start the routine again.
    const first = await getActiveWorkout()
    await act(() => updateWorkout(first!.id, { status: 'finished', endedAt: new Date().toISOString() }))
    await act(() => onStartRoutine(legs.id))
    await waitFor(() => expect(row('Fila 1')).toHaveTextContent('100 × 5'))

    await user.type(screen.getByRole('textbox', { name: 'kg fila 1' }), '102,5')
    await user.click(screen.getByRole('button', { name: 'Completar fila 1' }))

    expect(await screen.findByText('PR')).toBeInTheDocument()
    expect(screen.getAllByText('PR')).toHaveLength(1)
  })

  it('the rest end is announced to screen readers', async () => {
    const push = await seedRoutine({ name: 'Push', exercises: [{ exerciseId: 'ex-banca', sets: 1 }] })
    const w = await act(() => onStartRoutine(push.id))
    await updateWorkout(w.id, { restEndsAt: new Date(Date.now() + 1200).toISOString() })
    renderWorkoutUi()
    await screen.findByRole('dialog', { name: 'Entreno activo' })

    await waitFor(() => expect(screen.getByText('Descanso terminado')).toBeInTheDocument(), { timeout: 4000 })
    expect(screen.getByText('Descanso terminado').closest('[aria-live]')).toHaveAttribute('aria-live', 'assertive')
  })
})

describe('V5 · inputs', () => {
  it('typing "82,5" in a kg row stores 82.5 kg', async () => {
    const user = userEvent.setup()
    const push = await seedRoutine({ name: 'Push', exercises: [{ exerciseId: 'ex-banca', sets: 1 }] })
    await startAndOpen(push.id)

    await user.type(await screen.findByRole('textbox', { name: 'kg fila 1' }), '82,5')
    await user.tab()

    await waitFor(async () => expect((await setsOf())[0]!.weight).toBe(82.5))
  })

  it('typing 185 in an lb row stores about 83.9 kg and redisplays 185 lb', async () => {
    const user = userEvent.setup()
    await saveSettings({ unit: 'lb' })
    const push = await seedRoutine({ name: 'Push', exercises: [{ exerciseId: 'ex-banca', sets: 1 }] })
    await startAndOpen(push.id)

    expect(await screen.findByRole('columnheader', { name: 'LB' })).toBeInTheDocument()
    const input = screen.getByRole('textbox', { name: 'lb fila 1' })
    await user.type(input, '185')
    await user.tab()

    await waitFor(async () => expect((await setsOf())[0]!.weight).toBeCloseTo(83.91, 2))
    expect(input).toHaveValue('185')
  })

  it('a time exercise row records a stopwatch duration', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-19T10:00:00.000Z'))
    const user = userEvent.setup()
    const core = await seedRoutine({ name: 'Core', exercises: [{ exerciseId: 'ex-plancha', sets: 1 }] })
    await startAndOpen(core.id)

    expect(await screen.findByRole('columnheader', { name: 'Tiempo' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Reps' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cronometrar fila 1' }))
    vi.setSystemTime(new Date('2026-11-19T10:00:45.000Z'))
    await user.click(screen.getByRole('button', { name: 'Detener cronómetro fila 1' }))

    await waitFor(async () => expect((await setsOf())[0]!.durationSec).toBe(45))
    expect(screen.getByRole('textbox', { name: 'Tiempo fila 1' })).toHaveValue('00:45')
  })
})

describe('V5 · leaving and coming back', () => {
  it('finishing with unchecked sets shows the warning', async () => {
    const user = userEvent.setup()
    const push = await seedRoutine({ name: 'Push', exercises: [{ exerciseId: 'ex-banca', sets: 2 }] })
    await startAndOpen(push.id)
    await screen.findByRole('row', { name: 'Fila 2' })

    await user.click(screen.getByRole('button', { name: 'Finalizar' }))

    const warning = await screen.findByRole('alertdialog')
    expect(warning).toHaveTextContent('Tienes 2 series sin marcar')
  })

  it('reloading mid-workout restores the sets, the elapsed time and the remaining rest', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-19T10:42:18.000Z'))
    const user = userEvent.setup()
    const push = await seedRoutine({ name: 'Push', exercises: [{ exerciseId: 'ex-banca', sets: 2 }] })
    const w = await onStartRoutine(push.id)
    const [set] = await setsOf()
    await completeSet({
      workoutId: w.id,
      setId: set!.id,
      values: { weight: 80, reps: 8, durationSec: null },
      // Rest until 10:43:30, so 1:12 remain at 10:42:18.
      restSec: 150,
      now: Date.parse('2026-11-19T10:41:00.000Z'),
    })
    await updateWorkout(w.id, { startedAt: '2026-11-19T10:00:00.000Z' })
    // A fresh page load: the UI state starts over.
    resetWorkoutUi()
    renderWorkoutUi()

    const banner = await screen.findByRole('region', { name: 'Tienes un entreno en curso' })
    await user.click(within(banner).getByRole('button', { name: 'Continuar' }))

    const v5 = await screen.findByRole('dialog', { name: 'Entreno activo' })
    expect(within(v5).getByText('00:42:18')).toBeInTheDocument()
    expect(within(v5).getByRole('button', { name: /Descanso 1:12/ })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'kg fila 1' })).toHaveValue('80'))
    expect(screen.getByRole('button', { name: 'Completar fila 1' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('minimizing shows the mini-player with the routine name and chronometer; tapping it reopens V5', async () => {
    const user = userEvent.setup()
    const push = await seedRoutine({ name: 'Push', exercises: [{ exerciseId: 'ex-banca', sets: 1 }] })
    await startAndOpen(push.id)

    await user.click(screen.getByRole('button', { name: 'Minimizar entreno' }))

    expect(screen.queryByRole('dialog', { name: 'Entreno activo' })).not.toBeInTheDocument()
    const player = await screen.findByRole('button', { name: /Volver al entreno Push/ })
    expect(player).toHaveTextContent(/00:00:0\d/)
    await user.click(player)
    expect(await screen.findByRole('dialog', { name: 'Entreno activo' })).toBeInTheDocument()
  })

  it('a workout open more than 6 hours is offered to be saved with the last set time as end (F5)', async () => {
    const user = userEvent.setup()
    const push = await seedRoutine({ name: 'Push', exercises: [{ exerciseId: 'ex-banca', sets: 1 }] })
    const w = await onStartRoutine(push.id)
    const [set] = await setsOf()
    await completeSet({
      workoutId: w.id,
      setId: set!.id,
      values: { weight: 80, reps: 8, durationSec: null },
      restSec: 0,
      now: Date.now() - 7 * 3_600_000,
    })
    const lastSetAt = (await setsOf())[0]!.completedAt
    await updateWorkout(w.id, { startedAt: new Date(Date.now() - 8 * 3_600_000).toISOString() })
    resetWorkoutUi()
    renderWorkoutUi()

    const banner = await screen.findByRole('region', { name: 'Tienes un entreno en curso' })
    await user.click(within(banner).getByRole('button', { name: 'Guardar' }))

    await waitFor(async () =>
      expect(await getWorkout(w.id)).toMatchObject({ status: 'finished', endedAt: lastSetAt }),
    )
  })
})

describe('V5 · free workout (F6)', () => {
  it('starts empty with FINALIZAR disabled and adds exercises from V4', async () => {
    const user = userEvent.setup()
    await startAndOpen(null)

    expect(await screen.findByText('Aún no hay ejercicios')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finalizar' })).toBeDisabled()

    await user.click(screen.getAllByRole('button', { name: 'Añadir ejercicio' })[0]!)
    await user.click(await screen.findByRole('checkbox', { name: 'Remo con barra' }))
    await user.click(screen.getByRole('button', { name: 'Añadir (1)' }))

    expect(await screen.findByRole('group', { name: /Remo con barra/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finalizar' })).toBeEnabled()
  })
})
