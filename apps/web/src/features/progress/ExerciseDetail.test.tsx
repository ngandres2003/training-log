import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteRoutine } from '../../data/repositories/routines'
import { resetDb } from '../../data/testUtils'
import {
  freezeToday,
  renderProgress,
  seedRoutine,
  seedSession,
  stubCatalog,
  stubResizeObserver,
} from './test-helpers'

beforeEach(async () => {
  await resetDb()
  stubCatalog()
  stubResizeObserver()
  freezeToday()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const record = (name: string) => screen.getByRole('group', { name })
const historyLinks = () =>
  within(screen.getByRole('region', { name: 'Historial' })).getAllByRole('link')

async function seedBenchInTwoRoutines() {
  const push = await seedRoutine('Push')
  const full = await seedRoutine('Full body')
  await seedSession({
    routineId: push.id,
    name: 'Push',
    startedAt: '2026-11-01T10:00:00.000Z',
    exercises: [
      {
        exerciseId: 'ex-banca',
        sets: [
          { weight: 140, reps: 1, type: 'warmup' },
          { weight: 60, reps: 10 },
          { weight: 65, reps: 5 },
        ],
      },
    ],
  })
  await seedSession({
    routineId: full.id,
    name: 'Full body',
    startedAt: '2026-11-08T10:00:00.000Z',
    exercises: [{ exerciseId: 'ex-banca', sets: [{ weight: 72.5, reps: 8 }] }],
  })
  await seedSession({
    routineId: push.id,
    name: 'Push',
    startedAt: '2026-11-15T10:00:00.000Z',
    exercises: [{ exerciseId: 'ex-banca', sets: [{ weight: 70, reps: 10 }] }],
  })
  return { push, full }
}

describe('Detalle de ejercicio (V11)', () => {
  it('graphs e1RM, max weight and volume and lists records and every session with its routine', async () => {
    await seedBenchInTwoRoutines()
    renderProgress('/progreso/ejercicios/ex-banca')

    expect(await screen.findByRole('heading', { name: 'Press banca' })).toBeInTheDocument()
    expect(await screen.findByRole('figure', { name: '1RM estimado' })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: 'Peso máximo' })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: 'Volumen por sesión' })).toBeInTheDocument()

    // The 140 kg warm-up is left out of the records.
    expect(record('Peso máximo')).toHaveTextContent('72,5 kg')
    expect(record('Mejor 1RM estimado')).toHaveTextContent('93,3 kg')
    expect(record('Más reps con un peso')).toHaveTextContent('70 kg × 10')
    expect(record('Mejor volumen en una sesión')).toHaveTextContent('925 kg')

    const sessions = historyLinks()
    expect(sessions.map((s) => within(s).getByText(/Push|Full body/).textContent)).toEqual([
      'Push',
      'Full body',
      'Push',
    ])
    expect(sessions[2]).toHaveTextContent('2 series')
  })

  it('"Solo en rutina X" shows only the sessions of that routine', async () => {
    const user = userEvent.setup()
    await seedBenchInTwoRoutines()
    renderProgress('/progreso/ejercicios/ex-banca')

    const filter = await screen.findByRole('combobox', { name: 'Solo en rutina' })
    await user.selectOptions(filter, 'Full body')
    expect(historyLinks()).toHaveLength(1)
    expect(historyLinks()[0]).toHaveTextContent('Full body')
    expect(record('Peso máximo')).toHaveTextContent('72,5 kg')
    // One session left: no trend line.
    expect(screen.queryByRole('figure', { name: '1RM estimado' })).not.toBeInTheDocument()

    await user.selectOptions(filter, 'Push')
    expect(historyLinks()).toHaveLength(2)
    expect(historyLinks().every((l) => l.textContent?.includes('Push'))).toBe(true)
    expect(record('Peso máximo')).toHaveTextContent('70 kg')

    await user.selectOptions(filter, 'Todas las rutinas')
    expect(historyLinks()).toHaveLength(3)
  })

  it('for a time exercise shows the duration chart and the longest-hold record', async () => {
    await seedSession({
      startedAt: '2026-11-10T10:00:00.000Z',
      exercises: [{ exerciseId: 'ex-plancha', sets: [{ durationSec: 60 }] }],
    })
    await seedSession({
      startedAt: '2026-11-17T10:00:00.000Z',
      exercises: [{ exerciseId: 'ex-plancha', sets: [{ durationSec: 45 }, { durationSec: 90 }] }],
    })
    renderProgress('/progreso/ejercicios/ex-plancha')

    expect(await screen.findByRole('figure', { name: 'Duración máxima' })).toBeInTheDocument()
    expect(record('Mayor duración')).toHaveTextContent('1:30 min')
    expect(screen.queryByRole('figure', { name: '1RM estimado' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Peso máximo' })).not.toBeInTheDocument()
  })

  it('for a reps exercise graphs max reps and added load', async () => {
    await seedSession({
      startedAt: '2026-11-10T10:00:00.000Z',
      exercises: [{ exerciseId: 'ex-fondos', sets: [{ reps: 12 }] }],
    })
    await seedSession({
      startedAt: '2026-11-17T10:00:00.000Z',
      exercises: [{ exerciseId: 'ex-fondos', sets: [{ reps: 8, weight: 10 }] }],
    })
    renderProgress('/progreso/ejercicios/ex-fondos')

    expect(await screen.findByRole('figure', { name: 'Reps máximas' })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: 'Lastre máximo' })).toBeInTheDocument()
    expect(record('Más reps en una serie')).toHaveTextContent('12 reps')
    expect(record('Mayor lastre')).toHaveTextContent('+10 kg')
  })

  it('shows an empty state when the exercise has no sessions', async () => {
    renderProgress('/progreso/ejercicios/ex-banca')
    expect(await screen.findByText('Aún no has registrado este ejercicio')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Historial' })).not.toBeInTheDocument()
  })

  it('with one session shows records but no trend lines', async () => {
    await seedSession({
      startedAt: '2026-11-17T10:00:00.000Z',
      exercises: [{ exerciseId: 'ex-banca', sets: [{ weight: 60, reps: 10 }] }],
    })
    renderProgress('/progreso/ejercicios/ex-banca')
    expect(await screen.findByRole('group', { name: 'Peso máximo' })).toHaveTextContent('60 kg')
    expect(screen.queryByRole('figure')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/)
  })

  it('labels sessions of a deleted routine with "(eliminada)"', async () => {
    const pierna = await seedRoutine('Pierna B')
    await seedSession({
      routineId: pierna.id,
      name: 'Pierna B',
      startedAt: '2026-11-17T10:00:00.000Z',
      exercises: [{ exerciseId: 'ex-sentadilla', sets: [{ weight: 100, reps: 5 }] }],
    })
    await deleteRoutine(pierna.id)
    renderProgress('/progreso/ejercicios/ex-sentadilla')
    expect(
      await screen.findByText('Pierna B (eliminada)', { selector: 'span' }),
    ).toBeInTheDocument()
  })
})
