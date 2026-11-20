import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDb } from '../../data/testUtils'
import { renderRoutines, seedFinishedWorkout, seedRoutine, stubCatalog } from './test-helpers'

beforeEach(async () => {
  await resetDb()
  stubCatalog()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function seedPushWithSessions() {
  const push = await seedRoutine({
    name: 'Push',
    exercises: [{ exerciseId: 'cat-banca', sets: 3, repsMin: 8, repsMax: 12, weight: 60 }],
  })
  const older = await seedFinishedWorkout({
    routineId: push.id,
    name: 'Push',
    startedAt: '2026-11-10T18:00:00.000Z',
    minutes: 50,
    energy: 4,
    sets: [
      { weight: 60, reps: 10, rpe: 8 },
      { weight: 60, reps: 10 },
    ],
  })
  const newer = await seedFinishedWorkout({
    routineId: push.id,
    name: 'Push',
    startedAt: '2026-11-14T18:00:00.000Z',
    minutes: 70,
    energy: 2,
    note: 'Hombro cargado',
    sets: [{ weight: 70, reps: 10, rpe: 9 }],
  })
  // A session of another routine is not part of this routine's history.
  await seedFinishedWorkout({ routineId: null, name: 'Entreno libre', startedAt: '2026-11-15T18:00:00.000Z' })
  return { push, older, newer }
}

describe('Detalle de rutina (V2)', () => {
  it('lists exercises with sets × reps and target weight', async () => {
    const { push } = await seedPushWithSessions()
    renderRoutines(`/rutinas/${push.id}`)

    expect(await screen.findByRole('heading', { name: 'Push' })).toBeInTheDocument()
    const list = screen.getByRole('tabpanel', { name: 'Ejercicios' })
    expect(await within(list).findByText('Press banca')).toBeInTheDocument()
    expect(within(list).getByText('3 × 8–12 · 60 kg')).toBeInTheDocument()
  })

  it('Historial lists only this routine sessions, newest first, and opens V8', async () => {
    const user = userEvent.setup()
    const { push, newer } = await seedPushWithSessions()
    renderRoutines(`/rutinas/${push.id}`)

    await user.click(await screen.findByRole('tab', { name: 'Historial' }))
    const panel = screen.getByRole('tabpanel', { name: 'Historial' })
    const sessions = await within(panel).findAllByRole('link')
    expect(sessions).toHaveLength(2)
    expect(sessions[0]).toHaveTextContent('70 min')
    expect(sessions[0]).toHaveTextContent('700 kg')
    expect(sessions[0]).toHaveTextContent('Hombro cargado')
    expect(sessions[1]).toHaveTextContent('1200 kg')

    await user.click(sessions[0]!)
    expect(await screen.findByRole('heading', { name: `Sesión ${newer.id}` })).toBeInTheDocument()
  })

  it('Estadísticas shows mean energy and mean RPE separately (R28)', async () => {
    const user = userEvent.setup()
    const { push } = await seedPushWithSessions()
    renderRoutines(`/rutinas/${push.id}`)

    await user.click(await screen.findByRole('tab', { name: 'Estadísticas' }))
    const panel = screen.getByRole('tabpanel', { name: 'Estadísticas' })
    expect(await within(panel).findByText('Veces realizada')).toBeInTheDocument()
    const stat = (label: string) => within(panel).getByText(label).closest('div')!
    expect(stat('Veces realizada')).toHaveTextContent('2')
    expect(stat('Duración media')).toHaveTextContent('60 min')
    expect(stat('Energía media')).toHaveTextContent('3,0')
    expect(stat('RPE medio')).toHaveTextContent('8,5')
    expect(stat('Mejor sesión')).toHaveTextContent('1200 kg')
  })
})
