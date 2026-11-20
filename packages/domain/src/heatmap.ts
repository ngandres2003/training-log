import { localDayKey, type DayKey } from './dates'
import type { WorkoutTables } from './history'
import { isWorkingSet } from './volume'

/** 0 is the empty level; 1–4 are increasing intensity (R27). */
export type HeatmapLevel = 0 | 1 | 2 | 3 | 4

/** Minimum sets for levels 2, 3 and 4. Level 1 is any day with at least one set. */
export type HeatmapThresholds = readonly [number, number, number]

/**
 * Used while history is short or flat. A typical session is 15–25 working sets,
 * so a full session reads as level 4 and a light one as level 1–2.
 * 1–5 → 1, 6–11 → 2, 12–17 → 3, 18+ → 4.
 */
export const FIXED_HEATMAP_THRESHOLDS: HeatmapThresholds = [6, 12, 18]

/** Training days needed before levels follow the user's own distribution. */
export const MIN_DAYS_FOR_RELATIVE_HEATMAP = 20

/** Completed working sets per local day of finished workouts (all tracking types). */
export function completedSetsByDay(
  { workouts, workoutExercises, workoutSets }: WorkoutTables,
  timeZone: string,
): Map<DayKey, number> {
  const dayByWorkout = new Map(
    workouts
      .filter((w) => w.status === 'finished' && !w.deletedAt)
      .map((w) => [w.id, localDayKey(w.startedAt, timeZone)]),
  )
  const dayByExercise = new Map<string, DayKey>()
  for (const e of workoutExercises) {
    const day = dayByWorkout.get(e.workoutId)
    if (day && !e.deletedAt) dayByExercise.set(e.id, day)
  }
  const counts = new Map<DayKey, number>()
  for (const s of workoutSets) {
    const day = dayByExercise.get(s.workoutExerciseId)
    if (!day || s.deletedAt || !isWorkingSet(s)) continue
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  return counts
}

/**
 * Thresholds from the user's own non-zero days: the 25th, 50th and 75th
 * percentiles (nearest rank), so the lowest quarter is level 1 and the top
 * quarter (always including the top days) is level 4. Falls back to
 * FIXED_HEATMAP_THRESHOLDS with fewer than 20 training days or when the
 * quartiles collapse to one value.
 */
export function heatmapThresholds(dayCounts: Iterable<number>): HeatmapThresholds {
  const sorted = [...dayCounts].filter((c) => c > 0).sort((a, b) => a - b)
  if (sorted.length < MIN_DAYS_FOR_RELATIVE_HEATMAP) return FIXED_HEATMAP_THRESHOLDS
  const q = (p: number) => sorted[Math.ceil(p * sorted.length) - 1]!
  const thresholds = [q(0.25), q(0.5), q(0.75)] as const
  if (thresholds[0] === thresholds[2]) return FIXED_HEATMAP_THRESHOLDS
  return thresholds
}

export function heatmapLevel(count: number, [t2, t3, t4]: HeatmapThresholds): HeatmapLevel {
  if (count <= 0) return 0
  if (count >= t4) return 4
  if (count >= t3) return 3
  if (count >= t2) return 2
  return 1
}
