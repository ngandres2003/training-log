import type { ExerciseSession } from './history'
import type { TrackingType, WorkoutSet } from './types'
import { e1rm, isWorkingSet, setVolume } from './volume'

export type SetValues = Pick<WorkoutSet, 'type' | 'weight' | 'reps' | 'durationSec'>

/** The record a set beat. One badge per set (R22). */
export type PrKind =
  | 'max_weight'
  | 'e1rm'
  | 'reps_at_weight'
  | 'max_reps'
  | 'max_added_load'
  | 'max_duration'

/** Marks of an exercise. Fields that do not apply to its tracking type stay 0 / empty. */
export interface PersonalRecords {
  /** weight_reps: heaviest weight. */
  maxWeight: number
  /** weight_reps: best e1RM over sets of 12 reps or fewer. */
  bestE1rm: number
  /** weight_reps: most reps done at each exact weight (kg). */
  repsAtWeight: Map<number, number>
  /** weight_reps and reps: highest volume in one session. */
  bestSessionVolume: number
  /** reps: most reps in a set. */
  maxReps: number
  /** reps: heaviest added load. */
  maxAddedLoad: number
  /** time: longest duration in seconds. */
  maxDuration: number
}

const empty = (): PersonalRecords => ({
  maxWeight: 0,
  bestE1rm: 0,
  repsAtWeight: new Map(),
  bestSessionVolume: 0,
  maxReps: 0,
  maxAddedLoad: 0,
  maxDuration: 0,
})

function addSet(marks: PersonalRecords, s: SetValues) {
  const weight = s.weight ?? 0
  const reps = s.reps ?? 0
  marks.maxWeight = Math.max(marks.maxWeight, weight)
  marks.bestE1rm = Math.max(marks.bestE1rm, e1rm(s.weight, s.reps) ?? 0)
  if (s.weight != null && reps > 0) {
    marks.repsAtWeight.set(weight, Math.max(marks.repsAtWeight.get(weight) ?? 0, reps))
  }
  marks.maxReps = Math.max(marks.maxReps, reps)
  marks.maxAddedLoad = Math.max(marks.maxAddedLoad, weight)
  marks.maxDuration = Math.max(marks.maxDuration, s.durationSec ?? 0)
}

/**
 * Marks set by the working sets of past sessions. Null when the exercise has
 * no working set yet, which means the current session is its first.
 */
export function personalRecords(
  sessions: ExerciseSession[],
  trackingType: TrackingType,
): PersonalRecords | null {
  let marks: PersonalRecords | null = null
  for (const session of sessions) {
    const working = session.sets.filter(isWorkingSet)
    if (working.length === 0) continue
    marks ??= empty()
    for (const s of working) addSet(marks, s)
    const volume = working.reduce((sum, s) => sum + setVolume(s, trackingType), 0)
    marks.bestSessionVolume = Math.max(marks.bestSessionVolume, volume)
  }
  return marks
}

/**
 * The record a just-completed set beats, or null.
 * - The first session of an exercise only sets marks (R22), so no badge until
 *   `history` (past sessions, excluding the current one) has a working set.
 * - `earlier` are the sets already completed in the current session; they count as marks.
 * - Priority when several marks fall: max weight > e1RM > reps at weight.
 * - Bodyweight (`reps`) measures reps first, then added load; `time` measures duration (R23).
 */
export function detectPr(input: {
  trackingType: TrackingType
  history: ExerciseSession[]
  earlier: SetValues[]
  candidate: SetValues
}): PrKind | null {
  const { trackingType, candidate } = input
  if (!isWorkingSet(candidate)) return null
  const marks = personalRecords(input.history, trackingType)
  if (!marks) return null
  for (const s of input.earlier.filter(isWorkingSet)) addSet(marks, s)

  const weight = candidate.weight ?? 0
  const reps = candidate.reps ?? 0
  switch (trackingType) {
    case 'weight_reps': {
      if (candidate.weight != null && weight > marks.maxWeight) return 'max_weight'
      if ((e1rm(candidate.weight, candidate.reps) ?? 0) > marks.bestE1rm) return 'e1rm'
      const atWeight = candidate.weight == null ? undefined : marks.repsAtWeight.get(weight)
      if (atWeight !== undefined && reps > atWeight) return 'reps_at_weight'
      return null
    }
    case 'reps':
      if (reps > marks.maxReps) return 'max_reps'
      if (weight > marks.maxAddedLoad) return 'max_added_load'
      return null
    case 'time':
      return (candidate.durationSec ?? 0) > marks.maxDuration ? 'max_duration' : null
  }
}
