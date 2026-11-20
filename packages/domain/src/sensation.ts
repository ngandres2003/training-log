import type { Workout, WorkoutSet } from './types'
import { isWorkingSet } from './volume'

const average = (values: number[]) =>
  values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length

/**
 * "Sensación media" (R28): mean energy (1–5) of the workouts that logged it and
 * mean RPE of the completed working sets that have one, reported separately.
 * The caller picks the workouts and sets (a routine, a period).
 */
export function averageSensation(input: {
  workouts: Pick<Workout, 'energy'>[]
  sets: Pick<WorkoutSet, 'rpe' | 'type' | 'completed'>[]
}): { energy: number | null; rpe: number | null } {
  return {
    energy: average(input.workouts.flatMap((w) => (w.energy == null ? [] : [w.energy]))),
    rpe: average(input.sets.filter(isWorkingSet).flatMap((s) => (s.rpe == null ? [] : [s.rpe]))),
  }
}
