import type { SetType, TrackingType, WorkoutSet } from './types'

/** Sets above this many reps are too unreliable for e1RM and are ignored. */
export const E1RM_MAX_REPS = 12

/** Estimated 1RM by Epley: w × (1 + r / 30). Null when not computable or reps > 12. */
export function e1rm(weight: number | null, reps: number | null): number | null {
  if (weight == null || reps == null || weight <= 0 || reps < 1 || reps > E1RM_MAX_REPS) return null
  return weight * (1 + reps / 30)
}

/** Metrics count completed sets and leave warm-ups out. */
export const isWorkingSet = (s: { type: SetType; completed?: boolean }) =>
  s.type !== 'warmup' && s.completed !== false

/**
 * Volume of one set (R23): weight × reps; added load × reps for bodyweight
 * (0 without load); time exercises add no volume.
 */
export function setVolume(
  set: Pick<WorkoutSet, 'weight' | 'reps'>,
  trackingType: TrackingType,
): number {
  if (trackingType === 'time') return 0
  return (set.weight ?? 0) * (set.reps ?? 0)
}

/** Volume of completed working sets. */
export function totalVolume(
  sets: Pick<WorkoutSet, 'weight' | 'reps' | 'type' | 'completed'>[],
  trackingType: TrackingType,
): number {
  return sets.filter(isWorkingSet).reduce((sum, s) => sum + setVolume(s, trackingType), 0)
}
