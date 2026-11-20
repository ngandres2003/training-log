import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDb } from '../../data/testUtils'
import {
  freezeToday,
  renderProgress,
  seedSession,
  stubCatalog,
  stubResizeObserver,
  type SeedSet,
} from './test-helpers'

beforeEach(async () => {
  await resetDb()
  stubCatalog()
  stubResizeObserver()
  freezeToday() // Friday 2026-11-20: "4 sem" is 24 oct – 20 nov, the previous period 26 sep – 23 oct.
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const sets = (n: number, set: SeedSet = { weight: 60, reps: 10 }) =>
  Array.from({ length: n }, () => set)
const kpi = (name: string) => screen.getByRole('group', { name })

describe('Progreso (V10)', () => {
  it('shows an empty state with no sessions', async () => {
    renderProgress()
    expect(await screen.findByText('Aún no hay progreso que mostrar')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Entrenos' })).not.toBeInTheDocument()
  })

  it('with one session shows values but no delta, no trend charts and no division by zero', async () => {
    await seedSession({
      startedAt: '2026-11-18T10:00:00.000Z',
      exercises: [{ exerciseId: 'ex-banca', sets: sets(2) }],
    })
    renderProgress()

    expect(await screen.findByRole('group', { name: 'Entrenos' })).toHaveTextContent('1')
    expect(kpi('Volumen total')).toHaveTextContent('1.200 kg')
    expect(kpi('Duración media')).toHaveTextContent('60 min')
    expect(screen.queryByText(/vs\. periodo anterior/)).not.toBeInTheDocument()
    expect(screen.queryByRole('figure', { name: 'Volumen semanal' })).not.toBeInTheDocument()
    expect(screen.queryByRole('figure', { name: 'Frecuencia semanal' })).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/)
  })

  it('KPI deltas compare against the immediately preceding period of equal length', async () => {
    const user = userEvent.setup()
    // Previous period: 1 workout, 1 set, 500 kg, 60 min.
    await seedSession({
      startedAt: '2026-10-10T10:00:00.000Z',
      exercises: [{ exerciseId: 'ex-banca', sets: sets(1, { weight: 50, reps: 10 }) }],
    })
    // Before the previous period: counted only under "Todo".
    await seedSession({
      startedAt: '2026-08-01T10:00:00.000Z',
      exercises: [{ exerciseId: 'ex-banca', sets: sets(1) }],
    })
    // Current period: 2 workouts, 3 sets, 1800 kg, 45 and 75 min.
    await seedSession({
      startedAt: '2026-11-02T10:00:00.000Z',
      minutes: 45,
      exercises: [{ exerciseId: 'ex-banca', sets: sets(2) }],
    })
    await seedSession({
      startedAt: '2026-11-18T10:00:00.000Z',
      minutes: 75,
      exercises: [{ exerciseId: 'ex-banca', sets: sets(1) }],
    })
    renderProgress()

    expect(await screen.findByRole('group', { name: 'Entrenos' })).toHaveTextContent(
      '2+1 vs. periodo anterior',
    )
    expect(kpi('Volumen total')).toHaveTextContent('1.800 kg+1.300 kg vs. periodo anterior')
    expect(kpi('Duración media')).toHaveTextContent('60 min±0 min vs. periodo anterior')
    expect(kpi('Series totales')).toHaveTextContent('3+2 vs. periodo anterior')
    expect(screen.getByRole('figure', { name: 'Volumen semanal' })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: 'Frecuencia semanal' })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Todo' }))
    expect(kpi('Entrenos')).toHaveTextContent(/^Entrenos4$/)
    expect(screen.queryByText(/vs\. periodo anterior/)).not.toBeInTheDocument()
  })

  it('leaves warm-up sets out of the KPIs', async () => {
    await seedSession({
      startedAt: '2026-11-18T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'ex-banca',
          sets: [
            { weight: 40, reps: 10, type: 'warmup' },
            { weight: 60, reps: 10 },
          ],
        },
      ],
    })
    renderProgress()
    expect(await screen.findByRole('group', { name: 'Series totales' })).toHaveTextContent('1')
    expect(kpi('Volumen total')).toHaveTextContent('600 kg')
  })

  it('colors the muscle map with this week: primary counts 1 and secondary 0.5', async () => {
    await seedSession({
      startedAt: '2026-11-18T10:00:00.000Z',
      exercises: [{ exerciseId: 'ex-banca', sets: sets(1) }],
    })
    // Earlier week: in the period but not in this week's map.
    await seedSession({
      startedAt: '2026-11-04T10:00:00.000Z',
      exercises: [{ exerciseId: 'ex-remo', sets: sets(3) }],
    })
    renderProgress()
    const map = await screen.findByRole('figure', { name: 'Mapa muscular de esta semana' })
    expect(map).toHaveTextContent('Esta semana: Pecho 1,0 series, Tríceps 0,5 series.')
  })

  it('features the 5 exercises with the most completed sets in the period and opens V11', async () => {
    const user = userEvent.setup()
    await seedSession({
      startedAt: '2026-09-01T10:00:00.000Z',
      exercises: [{ exerciseId: 'ex-fondos', sets: sets(30, { reps: 10 }) }],
    })
    await seedSession({
      startedAt: '2026-11-18T10:00:00.000Z',
      exercises: [
        { exerciseId: 'ex-banca', sets: sets(6) },
        { exerciseId: 'ex-remo', sets: sets(2) },
        { exerciseId: 'ex-sentadilla', sets: sets(5) },
        { exerciseId: 'ex-militar', sets: sets(3) },
        { exerciseId: 'ex-curl', sets: sets(4) },
        { exerciseId: 'ex-peso-muerto', sets: sets(1) },
      ],
    })
    renderProgress()

    const section = await screen.findByRole('region', { name: 'Ejercicios destacados' })
    const items = await within(section).findAllByRole('link')
    expect(items.map((i) => i.textContent)).toEqual([
      'Press banca6 series',
      'Sentadilla5 series',
      'Curl de bíceps4 series',
      'Press militar3 series',
      'Remo con barra2 series',
    ])
    await user.click(items[0]!)
    expect(await screen.findByRole('heading', { name: 'Press banca' })).toBeInTheDocument()
  })

  it('shows mean energy and mean RPE separately, and hides RPE when no set has it', async () => {
    await seedSession({
      startedAt: '2026-11-17T10:00:00.000Z',
      energy: 4,
      exercises: [{ exerciseId: 'ex-banca', sets: sets(1) }],
    })
    const { unmount } = renderProgress()
    expect(await screen.findByRole('group', { name: 'Energía media' })).toHaveTextContent('4,0/5')
    expect(screen.queryByRole('group', { name: 'RPE medio' })).not.toBeInTheDocument()
    unmount()

    await seedSession({
      startedAt: '2026-11-18T10:00:00.000Z',
      exercises: [
        {
          exerciseId: 'ex-banca',
          sets: [
            { weight: 60, reps: 10, rpe: 8 },
            { weight: 60, reps: 10, rpe: 9 },
          ],
        },
      ],
    })
    renderProgress()
    expect(await screen.findByRole('group', { name: 'RPE medio' })).toHaveTextContent('8,5')
  })

  it('lists recent records with their date, from the second session of an exercise', async () => {
    await seedSession({
      startedAt: '2026-11-10T10:00:00.000Z',
      exercises: [{ exerciseId: 'ex-sentadilla', sets: [{ weight: 100, reps: 5 }] }],
    })
    await seedSession({
      startedAt: '2026-11-17T10:00:00.000Z',
      exercises: [{ exerciseId: 'ex-sentadilla', sets: [{ weight: 102.5, reps: 5 }] }],
    })
    renderProgress()
    const section = await screen.findByRole('region', { name: 'Récords recientes' })
    const records = await within(section).findAllByRole('link')
    expect(records).toHaveLength(1)
    expect(records[0]).toHaveTextContent('Sentadilla')
    expect(records[0]).toHaveTextContent('Peso máximo · 102,5 kg × 5')
    expect(records[0]).toHaveTextContent('17 nov')
  })
})
