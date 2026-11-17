import type { Id, Workout, WorkoutExercise, WorkoutSet } from './types'

export interface WorkoutTables {
  workouts: Workout[]
  workoutExercises: WorkoutExercise[]
  workoutSets: WorkoutSet[]
}

/** One finished workout's completed sets of a single exercise. */
export interface ExerciseSession {
  workoutId: Id
  routineId: Id | null
  workoutName: string
  startedAt: string
  sets: WorkoutSet[]
}

/**
 * Finished, non-deleted sessions of an exercise, oldest first, with their
 * completed sets in row order. `excludeWorkoutId` leaves out the workout in progress.
 */
export function exerciseSessions(
  exerciseId: Id,
  { workouts, workoutExercises, workoutSets }: WorkoutTables,
  options: { excludeWorkoutId?: Id } = {},
): ExerciseSession[] {
  const byWorkout = new Map(
    workouts
      .filter((w) => w.status === 'finished' && !w.deletedAt && w.id !== options.excludeWorkoutId)
      .map((w) => [w.id, w]),
  )
  const exercises = workoutExercises
    .filter((e) => e.exerciseId === exerciseId && !e.deletedAt && byWorkout.has(e.workoutId))
    .sort((a, b) => a.order - b.order)
  const setsByExercise = new Map<Id, WorkoutSet[]>()
  for (const s of workoutSets) {
    if (!s.completed || s.deletedAt) continue
    const list = setsByExercise.get(s.workoutExerciseId) ?? []
    list.push(s)
    setsByExercise.set(s.workoutExerciseId, list)
  }

  const sessions = new Map<Id, ExerciseSession>()
  for (const e of exercises) {
    const w = byWorkout.get(e.workoutId)!
    const session = sessions.get(w.id) ?? {
      workoutId: w.id,
      routineId: w.routineId,
      workoutName: w.name,
      startedAt: w.startedAt,
      sets: [],
    }
    const sets = (setsByExercise.get(e.id) ?? []).sort((a, b) => a.order - b.order)
    session.sets.push(...sets)
    sessions.set(w.id, session)
  }
  return [...sessions.values()]
    .filter((s) => s.sets.length > 0)
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
}
