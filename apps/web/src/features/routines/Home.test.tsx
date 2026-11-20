import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFolder } from '../../data/repositories/folders'
import {
  listInicioRoutines,
  listRoutineExercises,
  listRoutineSets,
} from '../../data/repositories/routines'
import { getActiveWorkout, listWorkouts } from '../../data/repositories/workouts'
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

async function openCardMenu(user: ReturnType<typeof userEvent.setup>, routineName: string) {
  const card = await screen.findByRole('article', { name: routineName })
  await user.click(within(card).getByRole('button', { name: `Opciones de ${routineName}` }))
  return screen.getByRole('menu', { name: `Opciones de ${routineName}` })
}

describe('Inicio (V1)', () => {
  it('AE3: suggests Legs for the PPL cycle when the last session was Pull', async () => {
    const ppl = await createFolder({ name: 'PPL', order: 0, isCycle: true })
    await seedRoutine({ name: 'Push', folderId: ppl.id, order: 0 })
    const pull = await seedRoutine({ name: 'Pull', folderId: ppl.id, order: 1 })
    await seedRoutine({ name: 'Legs', folderId: ppl.id, order: 2 })
    await seedFinishedWorkout({ routineId: pull.id, name: 'Pull', startedAt: '2026-11-17T18:00:00.000Z' })

    renderRoutines()

    const today = await screen.findByRole('region', { name: 'Toca hoy' })
    await waitFor(() => expect(today).toHaveTextContent('Legs'))
    expect(today).not.toHaveTextContent('Pull')
    // The cycle folder shows its badge and numbers its routines in order.
    const folder = screen.getByRole('region', { name: 'PPL' })
    expect(within(folder).getByText('Ciclo')).toBeInTheDocument()
    expect(within(folder).getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual([
      'Push',
      'Pull',
      'Legs',
    ])
  })

  it('shows "Crea tu primera rutina" when there are no routines', async () => {
    renderRoutines()
    expect(await screen.findByText('Crea tu primera rutina')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Toca hoy' })).not.toBeInTheDocument()
  })

  it('archiving removes the card and lists it under Rutinas archivadas; restoring brings it back', async () => {
    const user = userEvent.setup()
    await seedRoutine({ name: 'Push' })
    await seedRoutine({ name: 'Pull' })
    renderRoutines()

    const menu = await openCardMenu(user, 'Push')
    await user.click(within(menu).getByRole('menuitem', { name: 'Archivar' }))

    await waitFor(() => expect(screen.queryByRole('article', { name: 'Push' })).not.toBeInTheDocument())
    expect(within(screen.getByRole('region', { name: 'Toca hoy' })).getByText('Pull')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Rutinas archivadas' }))
    const archived = await screen.findByRole('article', { name: 'Push' })
    await user.click(within(archived).getByRole('button', { name: 'Restaurar' }))
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Push' })).not.toBeInTheDocument())
    expect(screen.getByText('No hay rutinas archivadas.')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Volver' }))
    expect(await screen.findByRole('article', { name: 'Push' })).toBeInTheDocument()
  })

  it('AE7: deleting "Pierna B" after confirmation removes it, and its sessions keep the name as deleted', async () => {
    const user = userEvent.setup()
    const pierna = await seedRoutine({ name: 'Pierna B' })
    await seedFinishedWorkout({ routineId: pierna.id, name: 'Pierna B', startedAt: '2026-11-10T18:00:00.000Z' })
    renderRoutines()

    const menu = await openCardMenu(user, 'Pierna B')
    await user.click(within(menu).getByRole('menuitem', { name: 'Eliminar' }))
    const dialog = screen.getByRole('alertdialog', { name: '¿Eliminar «Pierna B»?' })
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }))

    await waitFor(() => expect(screen.queryByRole('article', { name: 'Pierna B' })).not.toBeInTheDocument())
    expect(await screen.findByText('Crea tu primera rutina')).toBeInTheDocument()
    const sessions = await listWorkouts()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({ name: 'Pierna B', routineDeleted: true })
  })

  it('cancelling the delete confirmation keeps the routine', async () => {
    const user = userEvent.setup()
    await seedRoutine({ name: 'Pierna B' })
    renderRoutines()

    const menu = await openCardMenu(user, 'Pierna B')
    await user.click(within(menu).getByRole('menuitem', { name: 'Eliminar' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(await listInicioRoutines()).toHaveLength(1)
  })

  it('duplicating a routine copies its exercises and sets with new ids', async () => {
    const user = userEvent.setup()
    const push = await seedRoutine({
      name: 'Push',
      exercises: [
        { exerciseId: 'cat-banca', sets: 3, repsMin: 6, repsMax: 8, weight: 60 },
        { exerciseId: 'cat-dominadas', sets: 2, repsMin: 10, repsMax: 10 },
      ],
    })
    renderRoutines()

    const menu = await openCardMenu(user, 'Push')
    await user.click(within(menu).getByRole('menuitem', { name: 'Duplicar' }))
    expect(await screen.findByRole('article', { name: 'Push (copia)' })).toBeInTheDocument()

    const copy = (await listInicioRoutines()).find((r) => r.name === 'Push (copia)')!
    expect(copy.id).not.toBe(push.id)
    const original = await listRoutineExercises(push.id)
    const copied = await listRoutineExercises(copy.id)
    expect(copied.map((e) => e.exerciseId)).toEqual(['cat-banca', 'cat-dominadas'])
    expect(copied.map((e) => e.id).some((id) => original.some((o) => o.id === id))).toBe(false)

    const bancaSets = await listRoutineSets(copied[0]!.id)
    expect(bancaSets.map((s) => [s.targetRepsMin, s.targetRepsMax, s.targetWeight])).toEqual([
      [6, 8, 60],
      [6, 8, 60],
      [6, 8, 60],
    ])
    const originalSetIds = (await listRoutineSets(original[0]!.id)).map((s) => s.id)
    expect(bancaSets.some((s) => originalSetIds.includes(s.id))).toBe(false)
    expect(await listRoutineSets(copied[1]!.id)).toHaveLength(2)
  })

  it('▶ Iniciar starts a workout of the routine and Home then offers "Continuar entreno"', async () => {
    const user = userEvent.setup()
    const push = await seedRoutine({ name: 'Push' })
    renderRoutines()

    const card = await screen.findByRole('article', { name: 'Push' })
    await user.click(within(card).getByRole('button', { name: 'Iniciar Push' }))

    expect(await screen.findByRole('button', { name: /Continuar entreno/ })).toBeInTheDocument()
    expect(await getActiveWorkout()).toMatchObject({ routineId: push.id, name: 'Push', status: 'active' })
  })

  it('"Empezar entreno vacío" asks first, and cancelling starts nothing', async () => {
    const user = userEvent.setup()
    renderRoutines()

    await user.click(await screen.findByRole('button', { name: 'Empezar entreno vacío' }))
    expect(await screen.findByText('¿Empezar entreno vacío?')).toBeTruthy()
    expect(await getActiveWorkout()).toBeFalsy()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText('¿Empezar entreno vacío?')).toBeNull()
    expect(await getActiveWorkout()).toBeFalsy()
  })

  it('"Empezar entreno vacío" starts a free workout after confirming', async () => {
    const user = userEvent.setup()
    renderRoutines()

    await user.click(await screen.findByRole('button', { name: 'Empezar entreno vacío' }))
    await user.click(await screen.findByRole('button', { name: 'Empezar' }))

    await waitFor(async () => expect(await getActiveWorkout()).toMatchObject({ routineId: null, status: 'active' }))
  })

  it('the folder menu marks a folder as a cycle', async () => {
    const user = userEvent.setup()
    const folder = await createFolder({ name: 'Torso/Pierna', order: 0 })
    await seedRoutine({ name: 'Torso', folderId: folder.id })
    renderRoutines()

    const section = await screen.findByRole('region', { name: 'Torso/Pierna' })
    expect(within(section).queryByText('Ciclo')).not.toBeInTheDocument()
    await user.click(within(section).getByRole('button', { name: 'Opciones de la carpeta Torso/Pierna' }))
    await user.click(screen.getByRole('menuitem', { name: 'Marcar como programa en ciclo' }))

    await waitFor(() => expect(within(section).getByText('Ciclo')).toBeInTheDocument())
  })
})
