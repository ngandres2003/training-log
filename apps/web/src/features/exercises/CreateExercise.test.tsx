import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listCustomExercises } from '../../data/repositories/exercises'
import { resetDb } from '../../data/testUtils'
import { CreateExercise } from './CreateExercise'

beforeEach(async () => {
  await resetDb()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nombre'), 'Plancha con lastre')
  await user.selectOptions(screen.getByLabelText('Músculo principal'), 'abdominals')
  const secondaries = screen.getByRole('group', { name: 'Músculos secundarios' })
  await user.click(within(secondaries).getByRole('checkbox', { name: 'Hombros' }))
  await user.selectOptions(screen.getByLabelText('Equipamiento'), 'bodyweight')
  await user.click(screen.getByRole('radio', { name: 'Tiempo' }))
}

describe('CreateExercise', () => {
  it('saves a custom exercise with the fixed muscle ids, equipment and tracking type', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(<CreateExercise onSaved={onSaved} onCancel={() => {}} />)

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled())
    const rows = await listCustomExercises()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      name: 'Plancha con lastre',
      primaryMuscle: 'abdominals',
      secondaryMuscles: ['shoulders'],
      equipment: 'bodyweight',
      trackingType: 'time',
      imageUrl: null,
    })
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: rows[0]!.id }))
  })

  it('compresses and uploads the photo, then stores its URL', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    const user = userEvent.setup()
    const compressed = new Blob(['small'], { type: 'image/webp' })
    const compress = vi.fn(async () => compressed)
    const upload = vi.fn(async () => 'https://store.public.blob.vercel-storage.com/u/photo-abc.webp')
    render(<CreateExercise onSaved={() => {}} onCancel={() => {}} compress={compress} upload={upload} />)

    await fillForm(user)
    const photo = new File(['big'], 'remo.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByLabelText('Foto (opcional)'), photo)
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await vi.waitFor(async () => expect(await listCustomExercises()).toHaveLength(1))
    expect(upload).toHaveBeenCalledWith(compressed)
    expect((await listCustomExercises())[0]!.imageUrl).toBe(
      'https://store.public.blob.vercel-storage.com/u/photo-abc.webp',
    )
  })

  it('offline: disables the photo picker and saves without a photo', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const user = userEvent.setup()
    const onSaved = vi.fn()
    render(<CreateExercise onSaved={onSaved} onCancel={() => {}} />)

    expect(screen.getByLabelText('Foto (opcional)')).toBeDisabled()
    expect(screen.getByText('La foto se puede añadir cuando haya conexión')).toBeInTheDocument()

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect((await listCustomExercises())[0]!.imageUrl).toBeNull()
  })
})
