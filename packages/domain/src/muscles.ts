import type { MuscleId } from './types'

export type BodyRegion = 'front' | 'back'

export interface Muscle {
  id: MuscleId
  label: string
  region: BodyRegion
}

/**
 * The fixed muscle list shared by the catalog, custom exercises and the muscle
 * map (R17). Ids match the free-exercise-db muscle names in snake_case, so
 * catalog entries map one to one.
 */
export const MUSCLES: readonly Muscle[] = [
  { id: 'chest', label: 'Pecho', region: 'front' },
  { id: 'shoulders', label: 'Hombros', region: 'front' },
  { id: 'biceps', label: 'Bíceps', region: 'front' },
  { id: 'forearms', label: 'Antebrazos', region: 'front' },
  { id: 'abdominals', label: 'Abdominales', region: 'front' },
  { id: 'quadriceps', label: 'Cuádriceps', region: 'front' },
  { id: 'adductors', label: 'Aductores', region: 'front' },
  { id: 'abductors', label: 'Abductores', region: 'front' },
  { id: 'neck', label: 'Cuello', region: 'front' },
  { id: 'traps', label: 'Trapecio', region: 'back' },
  { id: 'lats', label: 'Dorsales', region: 'back' },
  { id: 'middle_back', label: 'Espalda media', region: 'back' },
  { id: 'lower_back', label: 'Zona lumbar', region: 'back' },
  { id: 'triceps', label: 'Tríceps', region: 'back' },
  { id: 'glutes', label: 'Glúteos', region: 'back' },
  { id: 'hamstrings', label: 'Isquiotibiales', region: 'back' },
  { id: 'calves', label: 'Gemelos', region: 'back' },
]

const IDS = new Set(MUSCLES.map((m) => m.id))

export const isMuscleId = (id: string): id is MuscleId => IDS.has(id)

/**
 * Sets per muscle: each set counts 1 for the primary muscle and 0.5 for each
 * secondary muscle. The caller passes working sets per exercise for the period.
 */
export function setsPerMuscle(
  entries: { primaryMuscle: MuscleId; secondaryMuscles: MuscleId[]; sets: number }[],
): Map<MuscleId, number> {
  const result = new Map<MuscleId, number>()
  const add = (id: MuscleId, n: number) => result.set(id, (result.get(id) ?? 0) + n)
  for (const e of entries) {
    add(e.primaryMuscle, e.sets)
    for (const m of e.secondaryMuscles) add(m, e.sets * 0.5)
  }
  return result
}
