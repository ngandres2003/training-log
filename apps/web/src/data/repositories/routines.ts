import type { Id, Routine, RoutineExercise, RoutineSet } from '@training-log/domain'
import { db } from '../db'
import { nowIso } from '../ids'
import {
  byOrder,
  getLive,
  inWriteTransaction,
  insertRow,
  listLive,
  softDeleteRows,
  updateRow,
  type RowInput,
  type RowPatch,
} from './base'

export interface NewRoutine {
  name: string
  color?: string
  folderId?: Id | null
  notes?: string
  order?: number
}

const DEFAULT_COLOR = '#888888'

async function nextOrder(): Promise<number> {
  const all = await listLive('routines')
  return all.reduce((max, r) => Math.max(max, r.order + 1), 0)
}

export function createRoutine(input: NewRoutine): Promise<Routine> {
  return inWriteTransaction(['routines'], async () =>
    insertRow('routines', {
      name: input.name,
      color: input.color ?? DEFAULT_COLOR,
      folderId: input.folderId ?? null,
      notes: input.notes ?? '',
      order: input.order ?? (await nextOrder()),
      archived: false,
      createdAt: nowIso(),
    }),
  )
}

export function updateRoutine(id: Id, patch: RowPatch<'routines'>): Promise<Routine> {
  return updateRow('routines', id, patch)
}

export function archiveRoutine(id: Id): Promise<Routine> {
  return updateRow('routines', id, { archived: true })
}

export function unarchiveRoutine(id: Id): Promise<Routine> {
  return updateRow('routines', id, { archived: false })
}

/**
 * Tombstones the routine template with its exercises and sets. Its workouts
 * are untouched and keep their copied name (R12).
 */
export function deleteRoutine(id: Id): Promise<void> {
  return inWriteTransaction(['routines', 'routineExercises', 'routineSets'], async () => {
    const exercises = await db.routineExercises.where('routineId').equals(id).toArray()
    const exerciseIds = exercises.map((e) => e.id)
    const sets = await db.routineSets.where('routineExerciseId').anyOf(exerciseIds).toArray()
    await softDeleteRows(
      'routineSets',
      sets.map((s) => s.id),
    )
    await softDeleteRows('routineExercises', exerciseIds)
    await softDeleteRows('routines', [id])
  })
}

export function getRoutine(id: Id): Promise<Routine | undefined> {
  return getLive('routines', id)
}

/** The Inicio routine list: live, not archived, in display order. */
export async function listInicioRoutines(): Promise<Routine[]> {
  return (await listLive('routines', (r) => !r.archived)).sort(byOrder)
}

/** Routines in the "Rutinas archivadas" section (R11). */
export async function listArchivedRoutines(): Promise<Routine[]> {
  return (await listLive('routines', (r) => r.archived)).sort(byOrder)
}

// Routine exercises and target sets

export function addRoutineExercise(input: {
  routineId: Id
  exerciseId: Id
  order: number
  restSec?: number | null
  note?: string
  supersetGroup?: string | null
}): Promise<RoutineExercise> {
  return insertRow('routineExercises', {
    routineId: input.routineId,
    exerciseId: input.exerciseId,
    order: input.order,
    restSec: input.restSec ?? null,
    note: input.note ?? '',
    supersetGroup: input.supersetGroup ?? null,
  })
}

export function updateRoutineExercise(id: Id, patch: RowPatch<'routineExercises'>): Promise<RoutineExercise> {
  return updateRow('routineExercises', id, patch)
}

export function removeRoutineExercise(id: Id): Promise<void> {
  return inWriteTransaction(['routineExercises', 'routineSets'], async () => {
    const sets = await db.routineSets.where('routineExerciseId').equals(id).toArray()
    await softDeleteRows(
      'routineSets',
      sets.map((s) => s.id),
    )
    await softDeleteRows('routineExercises', [id])
  })
}

export async function listRoutineExercises(routineId: Id): Promise<RoutineExercise[]> {
  const rows = await db.routineExercises.where('routineId').equals(routineId).toArray()
  return rows.filter((r) => r.deletedAt === null).sort(byOrder)
}

export function addRoutineSet(input: RowInput<'routineSets'>): Promise<RoutineSet> {
  return insertRow('routineSets', input)
}

export function updateRoutineSet(id: Id, patch: RowPatch<'routineSets'>): Promise<RoutineSet> {
  return updateRow('routineSets', id, patch)
}

export function removeRoutineSet(id: Id): Promise<void> {
  return softDeleteRows('routineSets', [id])
}

export async function listRoutineSets(routineExerciseId: Id): Promise<RoutineSet[]> {
  const rows = await db.routineSets.where('routineExerciseId').equals(routineExerciseId).toArray()
  return rows.filter((r) => r.deletedAt === null).sort(byOrder)
}
