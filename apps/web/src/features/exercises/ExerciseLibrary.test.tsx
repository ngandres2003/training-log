import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCustomExercise } from '../../data/repositories/exercises'
import { resetDb } from '../../data/testUtils'
import { ExerciseLibrary } from './ExerciseLibrary'
import { addCustom, addFinishedWorkout, stubCatalog } from './test-fixtures'

function renderLibrary() {
  render(
    <MemoryRouter>
      <ExerciseLibrary />
    </MemoryRouter>,
  )
}

const row = (name: string) => screen.getByText(name).closest('li') as HTMLElement

beforeEach(async () => {
  await resetDb()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ExerciseLibrary (V4, management mode)', () => {
  it('shows the equipment icon for a custom exercise without a photo', async () => {
    stubCatalog()
    await addCustom('Remo en polea', 'cable')
    renderLibrary()

    const r = await screen.findByText('Remo en polea').then(() => row('Remo en polea'))
    expect(within(r).getByRole('img', { name: 'Polea' })).toBeInTheDocument()
    expect(within(r).queryByRole('img', { name: /foto/i })).not.toBeInTheDocument()
  })

  it('shows "última vez" from the last local workout', async () => {
    stubCatalog()
    await addFinishedWorkout('cat-1', [
      { weight: 60, reps: 10 },
      { weight: 80, reps: 8 },
    ])
    renderLibrary()

    await screen.findByText('última vez: 80 kg × 8')
    expect(within(row('Press de banca con barra')).getByText('última vez: 80 kg × 8')).toBeInTheDocument()
    expect(within(row('Sentadilla con barra')).queryByText(/última vez/)).not.toBeInTheDocument()
  })

  it('"Mis ejercicios" lists only custom exercises', async () => {
    stubCatalog()
    await addCustom('Remo en polea')
    const user = userEvent.setup()
    renderLibrary()
    await screen.findByText('Sentadilla con barra')

    await user.click(screen.getByRole('button', { name: 'Mis ejercicios' }))
    expect(screen.getAllByRole('listitem').map((li) => within(li).getByTestId('exercise-name').textContent)).toEqual([
      'Remo en polea',
    ])
  })

  it('blocks deleting a custom exercise used in a past workout; it can only be edited', async () => {
    stubCatalog()
    const used = await addCustom('Remo Gironda')
    await addFinishedWorkout(used.id, [{ weight: 50, reps: 12 }])
    const user = userEvent.setup()
    renderLibrary()

    await user.click(await screen.findByRole('button', { name: 'Editar Remo Gironda' }))
    expect(await screen.findByText('Tiene historial: solo se puede editar.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar ejercicio' })).not.toBeInTheDocument()
    expect(await getCustomExercise(used.id)).toBeDefined()
  })

  it('deletes a custom exercise without history', async () => {
    stubCatalog()
    const unused = await addCustom('Face pull')
    const user = userEvent.setup()
    renderLibrary()

    await user.click(await screen.findByRole('button', { name: 'Editar Face pull' }))
    await user.click(await screen.findByRole('button', { name: 'Eliminar ejercicio' }))
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }))

    await screen.findByText('Sentadilla con barra')
    expect(screen.queryByText('Face pull')).not.toBeInTheDocument()
    expect(await getCustomExercise(unused.id)).toBeUndefined()
  })

  it('still lists custom exercises when the catalog is unavailable offline', async () => {
    stubCatalog(false)
    await addCustom('Remo en polea')
    renderLibrary()

    expect(await screen.findByText('Catálogo no disponible sin conexión')).toBeInTheDocument()
    expect(await screen.findByText('Remo en polea')).toBeInTheDocument()
  })
})
