import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listFolders } from '../../data/repositories/folders'
import { listInicioRoutines, listRoutineExercises, listRoutineSets } from '../../data/repositories/routines'
import { resetDb } from '../../data/testUtils'
import type { ExercisePickerProps } from '../exercises/ExercisePicker'
import { renderRoutines, seedRoutine, stubCatalog } from './test-helpers'

const picked = vi.hoisted(() => ({ ids: ['cat-banca', 'cat-plancha'] }))

vi.mock('../exercises/ExercisePicker', () => ({
  ExercisePicker: ({ onConfirm, onCancel }: ExercisePickerProps) => (
    <div role="dialog" aria-label="Seleccionar ejercicios">
      <button type="button" onClick={() => onConfirm(picked.ids)}>
        Añadir ({picked.ids.length})
      </button>
      <button type="button" onClick={onCancel}>
        Cerrar
      </button>
    </div>
  ),
}))

beforeEach(async () => {
  await resetDb()
  stubCatalog()
  picked.ids = ['cat-banca', 'cat-plancha']
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Crear / editar rutina (V3)', () => {
  it('F1: a new routine with picked exercises is saved and Home highlights its card', async () => {
    const user = userEvent.setup()
    renderRoutines()

    await user.click(await screen.findByRole('link', { name: 'Nueva rutina' }))
    await user.type(await screen.findByLabelText('Nombre'), 'Torso')
    await user.selectOptions(screen.getByLabelText('Carpeta'), 'new')
    await user.type(screen.getByLabelText('Nombre de la carpeta nueva'), 'Fuerza')
    await user.click(screen.getByRole('button', { name: '+ Añadir ejercicios' }))
    await user.click(screen.getByRole('button', { name: 'Añadir (2)' }))

    expect(await screen.findByRole('region', { name: 'Press banca' })).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Plancha' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    const card = await screen.findByRole('article', { name: 'Torso' })
    expect(card).toHaveAttribute('data-highlighted', 'true')
    expect(screen.getByText('Rutina «Torso» guardada')).toBeInTheDocument()

    const [routine] = await listInicioRoutines()
    const [folder] = await listFolders()
    expect(folder?.name).toBe('Fuerza')
    expect(routine).toMatchObject({ name: 'Torso', folderId: folder!.id })
    const exercises = await listRoutineExercises(routine!.id)
    expect(exercises.map((e) => e.exerciseId)).toEqual(['cat-banca', 'cat-plancha'])
    expect(await listRoutineSets(exercises[0]!.id)).toHaveLength(3)
  })

  it('shows targets by tracking type: weight, added load and duration', async () => {
    const user = userEvent.setup()
    picked.ids = ['cat-banca', 'cat-dominadas', 'cat-plancha']
    renderRoutines('/rutinas/nueva')

    await user.type(await screen.findByLabelText('Nombre'), 'Mixta')
    await user.click(screen.getByRole('button', { name: '+ Añadir ejercicios' }))
    await user.click(screen.getByRole('button', { name: 'Añadir (3)' }))

    const banca = await screen.findByRole('region', { name: 'Press banca' })
    const dominadas = await screen.findByRole('region', { name: 'Dominadas' })
    const plancha = await screen.findByRole('region', { name: 'Plancha' })

    expect(within(banca).getByLabelText('Peso objetivo (kg), serie 1')).toBeInTheDocument()
    expect(within(banca).getByLabelText('Reps mín., serie 1')).toBeInTheDocument()
    expect(within(banca).queryByLabelText(/Lastre/)).not.toBeInTheDocument()

    expect(within(dominadas).getByLabelText('Lastre (kg), serie 1')).toBeInTheDocument()
    expect(within(dominadas).getByLabelText('Reps mín., serie 1')).toBeInTheDocument()
    expect(within(dominadas).queryByLabelText(/Peso objetivo/)).not.toBeInTheDocument()

    expect(within(plancha).getByLabelText('Duración objetivo (s), serie 1')).toBeInTheDocument()
    expect(within(plancha).queryByLabelText(/Reps/)).not.toBeInTheDocument()
    expect(within(plancha).queryByLabelText(/Peso|Lastre/)).not.toBeInTheDocument()

    await user.type(within(banca).getByLabelText('Peso objetivo (kg), serie 1'), '62,5')
    await user.selectOptions(within(banca).getByLabelText('Tipo, serie 1'), 'warmup')
    await user.click(within(banca).getByRole('button', { name: '+ Serie' }))
    await user.type(within(dominadas).getByLabelText('Lastre (kg), serie 2'), '10')
    await user.clear(within(plancha).getByLabelText('Duración objetivo (s), serie 1'))
    await user.type(within(plancha).getByLabelText('Duración objetivo (s), serie 1'), '45')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await screen.findByRole('article', { name: 'Mixta' })
    const [routine] = await listInicioRoutines()
    const [ex1, ex2, ex3] = await listRoutineExercises(routine!.id)
    const bancaSets = await listRoutineSets(ex1!.id)
    expect(bancaSets).toHaveLength(4)
    expect(bancaSets[0]).toMatchObject({ type: 'warmup', targetWeight: 62.5, targetRepsMin: 8, targetRepsMax: 12 })
    expect((await listRoutineSets(ex2!.id))[1]).toMatchObject({ targetWeight: 10, targetDurationSec: null })
    expect((await listRoutineSets(ex3!.id))[0]).toMatchObject({
      targetDurationSec: 45,
      targetRepsMin: null,
      targetWeight: null,
    })
  })

  it('editing reorders with Subir/Bajar, groups a superset and keeps rest and note', async () => {
    const user = userEvent.setup()
    const r = await seedRoutine({
      name: 'Push',
      exercises: [
        { exerciseId: 'cat-banca', sets: 2 },
        { exerciseId: 'cat-dominadas', sets: 2 },
      ],
    })
    renderRoutines(`/rutinas/${r.id}/editar`)

    const banca = await screen.findByRole('region', { name: 'Press banca' })
    // Rest is optional: empty means no rest timer, there is no global default to fall back on.
    expect(within(banca).getByLabelText('Descanso (s)')).toHaveAttribute('placeholder', 'Sin descanso')
    await user.type(within(banca).getByLabelText('Descanso (s)'), '120')
    await user.type(within(banca).getByLabelText('Nota fija'), 'agarre neutro')
    await user.click(within(banca).getByRole('button', { name: 'Bajar' }))
    const dominadas = screen.getByRole('region', { name: 'Dominadas' })
    await user.click(within(dominadas).getByRole('checkbox', { name: 'Superserie con el siguiente' }))
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(async () => {
      const exercises = await listRoutineExercises(r.id)
      expect(exercises.map((e) => e.exerciseId)).toEqual(['cat-dominadas', 'cat-banca'])
    })
    const [first, second] = await listRoutineExercises(r.id)
    expect(second).toMatchObject({ restSec: 120, note: 'agarre neutro' })
    expect(first!.restSec).toBeNull()
    expect(first!.supersetGroup).not.toBeNull()
    expect(second!.supersetGroup).toBe(first!.supersetGroup)
    expect(await listRoutineSets(second!.id)).toHaveLength(2)
  })
})
