import type { CustomExercise, Id } from '@training-log/domain'
import { getLive, insertRow, listLive, softDeleteRows, updateRow, type RowInput, type RowPatch } from './base'

/** Custom exercises only; the catalog is a static asset and is not stored here (KTD11). */
export function createCustomExercise(input: RowInput<'customExercises'>): Promise<CustomExercise> {
  return insertRow('customExercises', input)
}

export function updateCustomExercise(id: Id, patch: RowPatch<'customExercises'>): Promise<CustomExercise> {
  return updateRow('customExercises', id, patch)
}

export function deleteCustomExercise(id: Id): Promise<void> {
  return softDeleteRows('customExercises', [id])
}

export function getCustomExercise(id: Id): Promise<CustomExercise | undefined> {
  return getLive('customExercises', id)
}

export async function listCustomExercises(): Promise<CustomExercise[]> {
  return (await listLive('customExercises')).sort((a, b) => a.name.localeCompare(b.name))
}
