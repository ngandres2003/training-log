import {
  exerciseSessions,
  formatWeight,
  otherRoutineChip,
  type Equipment,
  type Exercise,
  type Id,
  type TrackingType,
  type WeightUnit,
  type WorkoutSet,
  type WorkoutTables,
} from '@training-log/domain'
import { isCustomExercise } from './catalog'

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barra',
  dumbbell: 'Mancuerna',
  machine: 'Máquina',
  cable: 'Polea',
  bodyweight: 'Peso corporal',
  other: 'Otro',
}

export const TRACKING_LABELS: Record<TrackingType, string> = {
  weight_reps: 'Peso + reps',
  reps: 'Reps con lastre',
  time: 'Tiempo',
}

/** Lowercase without accents, for case- and accent-insensitive search. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export interface ExerciseFilters {
  query: string
  muscle: string | null
  equipment: Equipment | null
  mineOnly: boolean
}

/**
 * Every word of the query must appear in the Spanish name or the catalog's English alias,
 * so "press banca" matches "Press de banca con barra". Sorted by name.
 */
export function filterExercises(all: Exercise[], f: ExerciseFilters): Exercise[] {
  const words = normalize(f.query).split(/\s+/).filter(Boolean)
  return all
    .filter((e) => {
      if (f.muscle && e.primaryMuscle !== f.muscle) return false
      if (f.equipment && e.equipment !== f.equipment) return false
      if (f.mineOnly && !isCustomExercise(e)) return false
      if (words.length === 0) return true
      const haystack = normalize(`${e.name} ${'nameEn' in e ? String(e.nameEn) : ''}`)
      return words.every((w) => haystack.includes(w))
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

// A routine id no workout has, so `otherRoutineChip` considers every session.
const NO_ROUTINE = '\u0000none'

/** Best working set of the most recent finished session, per exercise id. */
export function lastSets(tables: WorkoutTables, exercises: Map<Id, Exercise>): Map<Id, WorkoutSet> {
  const result = new Map<Id, WorkoutSet>()
  const ids = new Set(tables.workoutExercises.map((we) => we.exerciseId))
  for (const id of ids) {
    const exercise = exercises.get(id)
    if (!exercise) continue
    const chip = otherRoutineChip(exerciseSessions(id, tables), NO_ROUTINE, exercise.trackingType)
    if (chip) result.set(id, chip.recent.bestSet)
  }
  return result
}

/** Exercise ids that appear in any live workout (finished or in progress). */
export function exercisesWithHistory(tables: WorkoutTables): Set<Id> {
  const liveWorkouts = new Set(tables.workouts.filter((w) => !w.deletedAt).map((w) => w.id))
  return new Set(
    tables.workoutExercises.filter((we) => !we.deletedAt && liveWorkouts.has(we.workoutId)).map((we) => we.exerciseId),
  )
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec} s`
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** e.g. "80 kg × 8", "+10 kg × 12", "12 reps", "1:30". */
export function formatSet(set: WorkoutSet, trackingType: TrackingType, unit: WeightUnit): string {
  switch (trackingType) {
    case 'weight_reps':
      return `${formatWeight(set.weight ?? 0, unit)} × ${set.reps ?? 0}`
    case 'reps':
      return set.weight ? `+${formatWeight(set.weight, unit)} × ${set.reps ?? 0}` : `${set.reps ?? 0} reps`
    case 'time':
      return formatDuration(set.durationSec ?? 0)
  }
}
