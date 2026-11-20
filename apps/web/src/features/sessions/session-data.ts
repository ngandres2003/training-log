import {
  averageSensation,
  diffRoutine,
  isWorkingSet,
  totalVolume,
  type Exercise,
  type Id,
  type RoutineChange,
  type TrackingType,
  type Workout,
} from '@training-log/domain'
import { db } from '../../data/db'
import { loadWorkoutData, type WorkoutData, type WorkoutModel } from '../workout/view-model'

/** What V7, the celebration, V8 and its editor read, in one live query. */
export interface SessionData extends WorkoutData {
  /** The workout came from a routine that has since been deleted (R12). */
  routineDeleted: boolean
  /** Last finished session of the same routine before this one, for the V7 comparison. */
  previous: Workout | null
}

/**
 * Loads the workout with the same shape as V5 (so V8 can reuse its rows), but only sessions
 * started before it count as history: a past session's PR badges and "Anterior" never look at
 * what came later, and editing it re-derives them (KTD7).
 */
export async function loadSessionData(workoutId: Id): Promise<SessionData | null> {
  const data = await loadWorkoutData(workoutId)
  if (!data) return null
  const { workout } = data
  const earlier = data.tables.workouts.filter((w) => w.startedAt < workout.startedAt)
  const routine = workout.routineId ? await db.routines.get(workout.routineId) : undefined
  const previous =
    workout.routineId === null
      ? null
      : (earlier
          .filter((w) => w.status === 'finished' && w.routineId === workout.routineId)
          .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
          .at(-1) ?? null)
  return {
    ...data,
    tables: { ...data.tables, workouts: earlier },
    routineDeleted: workout.routineId !== null && (!routine || routine.deletedAt !== null),
    previous,
  }
}

/** Title with " (eliminada)" when the source routine was deleted (R12). */
export const sessionTitle = (data: Pick<SessionData, 'workout' | 'routineDeleted'>) =>
  data.routineDeleted ? `${data.workout.name} (eliminada)` : data.workout.name

export interface SessionSummary {
  /** Null while there is no end (an unsaved workout uses `now`). */
  durationMs: number | null
  /** kg of completed working sets (domain volume). */
  volume: number
  /** Completed working sets. */
  sets: number
  reps: number
  /** Sets that beat a record (one per set, R22). */
  prs: number
  /** Mean RPE of the sets that logged one; null hides it (R25). */
  rpe: number | null
  /** Against the previous session of the same routine. */
  comparison: { volumePct: number | null; durationMs: number | null } | null
}

function workoutVolume(data: SessionData, workoutId: Id, trackingOf: (exerciseId: Id) => TrackingType): number {
  const exercises = data.tables.workoutExercises.filter((e) => e.workoutId === workoutId)
  return exercises.reduce(
    (sum, e) =>
      sum +
      totalVolume(
        data.tables.workoutSets.filter((s) => s.workoutExerciseId === e.id),
        trackingOf(e.exerciseId),
      ),
    0,
  )
}

/** Null for a workout without an end, unless `now` stands in for it. */
function durationOf(w: Pick<Workout, 'startedAt' | 'endedAt'>, now: number | null): number | null {
  const end = w.endedAt ? Date.parse(w.endedAt) : now
  return end == null ? null : end - Date.parse(w.startedAt)
}

/** Summary of V7 (live: pass `now` as the end) and of a saved session (V8, celebration). */
export function summarize(
  data: SessionData,
  model: WorkoutModel,
  lookup: Map<Id, Exercise>,
  now: number | null = null,
): SessionSummary {
  const trackingOf = (id: Id) => lookup.get(id)?.trackingType ?? 'weight_reps'
  const sets = model.exercises.flatMap((e) => e.sets.filter((s) => isWorkingSet(s.set) && s.set.completed))
  const durationMs = durationOf(data.workout, now)
  const previous = data.previous
  let comparison: SessionSummary['comparison'] = null
  if (previous) {
    const before = workoutVolume(data, previous.id, trackingOf)
    const previousMs = durationOf(previous, null)
    comparison = {
      volumePct: before > 0 ? ((model.volume - before) / before) * 100 : null,
      durationMs: durationMs != null && previousMs != null ? durationMs - previousMs : null,
    }
  }
  return {
    durationMs,
    volume: model.volume,
    sets: sets.length,
    reps: sets.reduce((sum, s) => sum + (s.set.reps ?? 0), 0),
    prs: sets.filter((s) => s.pr !== null).length,
    rpe: averageSensation({ workouts: [], sets: sets.map((s) => s.set) }).rpe,
    comparison,
  }
}

/** R24: differences between the routine and this workout; none for free or deleted routines. */
export function routineChanges(data: SessionData): RoutineChange[] {
  if (data.workout.routineId === null || data.routineDeleted) return []
  return diffRoutine({
    routineExercises: [...data.routineExercises.values()],
    routineSets: [...data.routineSetsByExercise.values()].flat(),
    workoutExercises: data.exercises,
    workoutSets: [...data.setsByExercise.values()].flat(),
  })
}
