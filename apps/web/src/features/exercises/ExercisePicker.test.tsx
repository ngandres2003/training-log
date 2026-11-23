import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDb } from '../../data/testUtils'
import { ExercisePicker } from './ExercisePicker'
import { resetCatalogCache } from './catalog'
import { CATALOG_FIXTURE, stubCatalog } from './test-fixtures'

function renderPicker(props: Partial<Parameters<typeof ExercisePicker>[0]> = {}) {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <MemoryRouter>
      <ExercisePicker onConfirm={onConfirm} onCancel={onCancel} {...props} />
    </MemoryRouter>,
  )
  return { onConfirm, onCancel }
}

const rowNames = () => screen.getAllByRole('listitem').map((li) => within(li).getByTestId('exercise-name').textContent)

beforeEach(async () => {
  await resetDb()
  stubCatalog()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ExercisePicker (V4, selection mode)', () => {
  it('renders a long catalog in steps as the end of the list comes near', async () => {
    const big = Array.from({ length: 100 }, (_, i) => ({
      ...CATALOG_FIXTURE[0]!,
      id: `cat-big-${i}`,
      name: `Ejercicio ${String(i).padStart(3, '0')}`,
    }))
    resetCatalogCache()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(big), { status: 200 })))
    let reveal: (() => void) | undefined
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          reveal = () => cb([{ isIntersecting: true } as IntersectionObserverEntry], this as never)
        }
        observe() {}
        disconnect() {}
      },
    )
    renderPicker()
    await screen.findByText('Ejercicio 000')
    await waitFor(() => expect(reveal).toBeDefined())
    expect(screen.getAllByTestId('exercise-name')).toHaveLength(40)

    await act(async () => reveal?.())
    await waitFor(() => expect(screen.getAllByTestId('exercise-name')).toHaveLength(80))
    // The live region still counts every result.
    expect(screen.getByText('100 ejercicios')).toBeInTheDocument()
  })

  it('matches "press banca" against "Press de banca" and "press banca inclinado", ignoring case and accents', async () => {
    const user = userEvent.setup()
    renderPicker()
    await screen.findByText('Sentadilla con barra')

    await user.type(screen.getByRole('searchbox', { name: 'Buscar ejercicio' }), 'press banca')
    expect(rowNames()).toEqual(['Press banca inclinado', 'Press de banca con barra'])

    await user.clear(screen.getByRole('searchbox', { name: 'Buscar ejercicio' }))
    await user.type(screen.getByRole('searchbox', { name: 'Buscar ejercicio' }), 'BICEPS')
    expect(rowNames()).toEqual(['Curl de bíceps'])

    // English alias from the catalog.
    await user.clear(screen.getByRole('searchbox', { name: 'Buscar ejercicio' }))
    await user.type(screen.getByRole('searchbox', { name: 'Buscar ejercicio' }), 'squat')
    expect(rowNames()).toEqual(['Sentadilla con barra'])
  })

  it('filters by muscle and equipment', async () => {
    const user = userEvent.setup()
    renderPicker()
    await screen.findByText('Sentadilla con barra')

    await user.selectOptions(screen.getByLabelText('Músculo'), 'chest')
    expect(rowNames()).toEqual(['Press banca inclinado', 'Press de banca con barra'])
    await user.selectOptions(screen.getByLabelText('Equipamiento'), 'barbell')
    expect(rowNames()).toEqual(['Press de banca con barra'])
  })

  it('offers "Crear «texto»" prefilled when a search has no results', async () => {
    const user = userEvent.setup()
    renderPicker()
    await screen.findByText('Sentadilla con barra')

    await user.type(screen.getByRole('searchbox', { name: 'Buscar ejercicio' }), 'remo gironda')
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Crear «remo gironda»' }))

    expect(await screen.findByRole('heading', { name: 'Crear ejercicio' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue('remo gironda')
  })

  it('returns the three selected ids when confirming "Añadir (3)"', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderPicker({ excludeIds: ['cat-5'] })
    await screen.findByText('Sentadilla con barra')

    // Already in the routine: shown as added and not selectable again.
    expect(screen.getByRole('checkbox', { name: 'Dominada' })).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: 'Sentadilla con barra' }))
    await user.click(screen.getByRole('checkbox', { name: 'Curl de bíceps' }))
    await user.click(screen.getByRole('checkbox', { name: 'Press de banca con barra' }))
    await user.click(screen.getByRole('button', { name: 'Añadir (3)' }))

    expect(onConfirm).toHaveBeenCalledWith(['cat-3', 'cat-4', 'cat-1'])
  })
})
