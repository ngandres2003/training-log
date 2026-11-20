import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoutine, deleteRoutine } from '../../data/repositories/routines'
import { saveSettings } from '../../data/repositories/settings'
import { resetDb } from '../../data/testUtils'
import { renderHistory, seedSession } from './test-helpers'

beforeEach(async () => {
  await resetDb()
  // Only Date is faked, so timers, Dexie and user-event keep running normally.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-20T12:00:00.000Z') })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** Non-empty heatmap cells as `[label, column, row, level]`. */
async function filledCells() {
  const heatmap = await screen.findByRole('group', { name: 'Mapa de calor de 2026' })
  await waitFor(() =>
    expect(heatmap.querySelectorAll('[data-level]:not([data-level="0"])').length).toBeGreaterThan(
      0,
    ),
  )
  return [...heatmap.querySelectorAll('[data-level]:not([data-level="0"])')].map((c) => [
    c.getAttribute('aria-label'),
    Number(c.getAttribute('data-col')),
    Number(c.getAttribute('data-row')),
    Number(c.getAttribute('data-level')),
  ])
}

describe('Historial (V9)', () => {
  // 2026-01-01 is a Thursday. Mon 5 Jan, Wed 18 Mar and Sun 15 Nov.
  async function seedThreeDays() {
    await seedSession({ day: '2026-01-05', name: 'Push', sets: 3 })
    await seedSession({ day: '2026-03-18', name: 'Pull', sets: 20 })
    await seedSession({ day: '2026-11-15', name: 'Legs', sets: 8 })
  }

  it('a year with workouts on 3 days renders 3 non-empty cells at Monday-start positions', async () => {
    await seedThreeDays()
    renderHistory()

    // Monday start: the grid begins on Mon 29 Dec 2025, rows are L–D.
    expect(await filledCells()).toEqual([
      ['lunes, 5 de enero de 2026: 3 series', 1, 0, 1],
      ['miércoles, 18 de marzo de 2026: 20 series', 11, 2, 4],
      ['domingo, 15 de noviembre de 2026: 8 series', 45, 6, 2],
    ])
    expect(screen.getByText('Días entrenados en 2026').nextElementSibling).toHaveTextContent('3')
  })

  it('shifts the cells for a Sunday week start', async () => {
    await saveSettings({ weekStart: 'sunday' })
    await seedThreeDays()
    renderHistory()

    // Sunday start: the grid begins on Sun 28 Dec 2025, rows are D–S.
    expect(await filledCells()).toEqual([
      ['lunes, 5 de enero de 2026: 3 series', 1, 1, 1],
      ['miércoles, 18 de marzo de 2026: 20 series', 11, 3, 4],
      ['domingo, 15 de noviembre de 2026: 8 series', 46, 0, 2],
    ])
  })

  it('tapping the heatmap opens the month of the tapped week; a day with two sessions lists both', async () => {
    const user = userEvent.setup()
    const push = await createRoutine({ name: 'Push', color: '#ff0000' })
    const morning = await seedSession({ day: '2026-11-10', name: 'Push', routineId: push.id })
    const evening = await seedSession({ day: '2026-11-10', name: 'Core' })
    await seedSession({ day: '2026-11-03', name: 'Push', routineId: push.id })
    renderHistory()

    await user.click(
      await screen.findByRole('img', { name: 'martes, 10 de noviembre de 2026: 6 series' }),
    )

    expect(screen.getByRole('radio', { name: 'Mes' })).toBeChecked()
    expect(screen.getByRole('heading', { name: 'noviembre de 2026' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'martes, 10 de noviembre: 2 sesiones' }))
    const day = screen.getByRole('region', { name: 'Sesiones del martes, 10 de noviembre' })
    const links = within(day).getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links.map((l) => l.getAttribute('href')).sort()).toEqual(
      [`/historial/sesiones/${morning.id}`, `/historial/sesiones/${evening.id}`].sort(),
    )
    expect(within(day).getByText('Push')).toBeInTheDocument()
    expect(within(day).getByText('Core')).toBeInTheDocument()

    await user.click(within(day).getByText('Core'))
    expect(await screen.findByRole('heading', { name: `Sesión ${evening.id}` })).toBeInTheDocument()
  })

  it('tapping a March cell opens March, and the month can be stepped', async () => {
    const user = userEvent.setup()
    await seedSession({ day: '2026-03-18', name: 'Pull' })
    renderHistory()

    await user.click(
      await screen.findByRole('img', { name: 'miércoles, 18 de marzo de 2026: 3 series' }),
    )
    expect(screen.getByRole('heading', { name: 'marzo de 2026' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'miércoles, 18 de marzo: 1 sesión' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(screen.getByRole('heading', { name: 'abril de 2026' })).toBeInTheDocument()
  })

  it('filtering by a deleted routine still lists its sessions', async () => {
    const user = userEvent.setup()
    const piernaB = await createRoutine({ name: 'Pierna B' })
    const push = await createRoutine({ name: 'Push' })
    const leg1 = await seedSession({ day: '2026-11-02', name: 'Pierna B', routineId: piernaB.id })
    const leg2 = await seedSession({ day: '2026-11-16', name: 'Pierna B', routineId: piernaB.id })
    await seedSession({ day: '2026-11-17', name: 'Push', routineId: push.id })
    await deleteRoutine(piernaB.id)
    renderHistory()

    const list = await screen.findByRole('region', { name: 'Sesiones' })
    await waitFor(() => expect(within(list).getAllByRole('link')).toHaveLength(3))
    // Grouped by week, newest first.
    expect(
      within(list)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(['Semana del 16 nov', 'Semana del 2 nov'])

    await user.selectOptions(
      within(list).getByRole('combobox', { name: 'Filtrar por rutina' }),
      'Pierna B (eliminada)',
    )

    const links = within(list).getAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      `/historial/sesiones/${leg2.id}`,
      `/historial/sesiones/${leg1.id}`,
    ])
    expect(links.every((l) => l.textContent?.includes('Pierna B (eliminada)'))).toBe(true)
    expect(within(list).queryByRole('link', { name: /Push/ })).not.toBeInTheDocument()
  })

  it('shows streak and adherence indicators from the domain rules', async () => {
    await saveSettings({ weeklyGoal: 1 })
    // One session in each of the three weeks up to this one (Mon 16 Nov is the current week).
    await seedSession({ day: '2026-11-03', name: 'A' })
    await seedSession({ day: '2026-11-10', name: 'A' })
    await seedSession({ day: '2026-11-17', name: 'A' })
    renderHistory()

    const indicators = await screen.findByRole('region', { name: 'Indicadores' })
    await waitFor(() =>
      expect(within(indicators).getByText('Racha actual').nextElementSibling).toHaveTextContent(
        '3 semanas',
      ),
    )
    expect(within(indicators).getByText('Mejor racha').nextElementSibling).toHaveTextContent(
      '3 semanas',
    )
    // 3 trained days over 1 Jan – 20 Nov (324 days) with 1 day a week: 3 / (324 / 7) ≈ 6 %.
    expect(within(indicators).getByText('Adherencia').nextElementSibling).toHaveTextContent('6 %')
  })

  it('an empty year shows the empty state', async () => {
    renderHistory()
    expect(await screen.findByText('Sin entrenos en 2026')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Sesiones' })).not.toBeInTheDocument()
  })

  it('the year selector moves to a past year that has sessions', async () => {
    const user = userEvent.setup()
    await seedSession({ day: '2025-06-10', name: 'Push' })
    renderHistory()

    expect(await screen.findByText('Sin entrenos en 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Año siguiente' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Año anterior' }))
    expect(await screen.findByRole('group', { name: 'Mapa de calor de 2025' })).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'martes, 10 de junio de 2025: 3 series' }),
    ).toHaveAttribute('data-level', '1')
    expect(screen.getByRole('button', { name: 'Año anterior' })).toBeDisabled()
  })
})
