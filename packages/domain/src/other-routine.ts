import type { ExerciseSession } from './history'
import type { Id, TrackingType, WorkoutSet } from './types'
import { e1rm, isWorkingSet } from './volume'

export interface OtherRoutineChip {
  /** Most recent session outside this routine (free workouts count) and its best set. */
  recent: { workoutId: Id; routineId: Id | null; workoutName: string; startedAt: string; bestSet: WorkoutSet }
  /** Best historical set outside this routine. `e1rm` is set only for weight_reps. */
  best: { workoutId: Id; startedAt: string; set: WorkoutSet; e1rm: number | null }
}

/**
 * Ranking of a set for "best set": e1RM (then weight) for weight_reps,
 * reps (then added load) for reps, and duration for time.
 */
function score(set: WorkoutSet, trackingType: TrackingType): [number, number] {
  switch (trackingType) {
    case 'weight_reps':
      return [e1rm(set.weight, set.reps) ?? 0, set.weight ?? 0]
    case 'reps':
      return [set.reps ?? 0, set.weight ?? 0]
    case 'time':
      return [set.durationSec ?? 0, 0]
  }
}

const better = (a: [number, number], b: [number, number]) =>
  a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])

function bestOf(sets: WorkoutSet[], trackingType: TrackingType): WorkoutSet | null {
  let best: WorkoutSet | null = null
  for (const s of sets) {
    if (!best || better(score(s, trackingType), score(best, trackingType))) best = s
  }
  return best
}

/** "En otra rutina" chip (R19). Null when the exercise has no working sets outside the routine. */
export function otherRoutineChip(
  sessions: ExerciseSession[],
  routineId: Id,
  trackingType: TrackingType,
): OtherRoutineChip | null {
  const outside = sessions
    .filter((s) => s.routineId !== routineId)
    .map((s) => ({ ...s, sets: s.sets.filter(isWorkingSet) }))
    .filter((s) => s.sets.length > 0)
  const recent = outside.at(-1)
  if (!recent) return null

  let best: OtherRoutineChip['best'] | null = null
  for (const s of outside) {
    const set = bestOf(s.sets, trackingType)!
    if (!best || better(score(set, trackingType), score(best.set, trackingType))) {
      best = { workoutId: s.workoutId, startedAt: s.startedAt, set, e1rm: null }
    }
  }
  best!.e1rm = trackingType === 'weight_reps' ? e1rm(best!.set.weight, best!.set.reps) : null

  return {
    recent: {
      workoutId: recent.workoutId,
      routineId: recent.routineId,
      workoutName: recent.workoutName,
      startedAt: recent.startedAt,
      bestSet: bestOf(recent.sets, trackingType)!,
    },
    best: best!,
  }
}
