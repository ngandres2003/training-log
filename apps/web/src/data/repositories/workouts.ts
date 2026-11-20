import type { Id, Workout, WorkoutExercise, WorkoutSet } from '@training-log/domain'
import { db } from '../db'
import { nowIso } from '../ids'
import {
  byOrder,
  getLive,
  inWriteTransaction,
  insertRow,
  listLive,
  softDeleteRows,
  updateRow,
  type RowInput,
  type RowPatch,
} from './base'

export interface WorkoutListItem extends Workout {
  /** The workout came from a routine that has since been deleted (R12). */
  routineDeleted: boolean
}

/** Starts a workout as a normal row with status `active` (KTD9). `name` is the routine name copy. */
export function startWorkout(input: { routineId: Id | null; name: string; startedAt?: string }): Promise<Workout> {
  return insertRow('workouts', {
    routineId: input.routineId,
    name: input.name,
    startedAt: input.startedAt ?? nowIso(),
    endedAt: null,
    status: 'active',
    energy: null,
    tags: [],
    note: '',
    restEndsAt: null,
  })
}

export function updateWorkout(id: Id, patch: RowPatch<'workouts'>): Promise<Workout> {
  return updateRow('workouts', id, patch)
}

/** Tombstones a workout with its exercises and sets. */
export function deleteWorkout(id: Id): Promise<void> {
  return inWriteTransaction(['workouts', 'workoutExercises', 'workoutSets'], async () => {
    const exercises = await db.workoutExercises.where('workoutId').equals(id).toArray()
    const exerciseIds = exercises.map((e) => e.id)
    const sets = await db.workoutSets.where('workoutExerciseId').anyOf(exerciseIds).toArray()
    await softDeleteRows(
      'workoutSets',
      sets.map((s) => s.id),
    )
    await softDeleteRows('workoutExercises', exerciseIds)
    await softDeleteRows('workouts', [id])
  })
}

export function getWorkout(id: Id): Promise<Workout | undefined> {
  return getLive('workouts', id)
}

/** The in-progress workout, if any (interrupted-workout recovery reads this, KTD9). */
export async function getActiveWorkout(): Promise<Workout | undefined> {
  const rows = await db.workouts.where('status').equals('active').toArray()
  return rows.find((w) => w.deletedAt === null)
}

/** Live workouts, newest first, flagged when their routine was deleted (R12). */
export async function listWorkouts(): Promise<WorkoutListItem[]> {
  const workouts = await listLive('workouts')
  const routineIds = [...new Set(workouts.flatMap((w) => (w.routineId ? [w.routineId] : [])))]
  const routines = await db.routines.bulkGet(routineIds)
  const liveRoutineIds = new Set(routines.flatMap((r) => (r && r.deletedAt === null ? [r.id] : [])))
  return workouts
    .map((w) => ({ ...w, routineDeleted: w.routineId !== null && !liveRoutineIds.has(w.routineId) }))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

// Workout exercises and sets

export function addWorkoutExercise(input: RowInput<'workoutExercises'>): Promise<WorkoutExercise> {
  return insertRow('workoutExercises', input)
}

export function updateWorkoutExercise(id: Id, patch: RowPatch<'workoutExercises'>): Promise<WorkoutExercise> {
  return updateRow('workoutExercises', id, patch)
}

export function removeWorkoutExercise(id: Id): Promise<void> {
  return inWriteTransaction(['workoutExercises', 'workoutSets'], async () => {
    const sets = await db.workoutSets.where('workoutExerciseId').equals(id).toArray()
    await softDeleteRows(
      'workoutSets',
      sets.map((s) => s.id),
    )
    await softDeleteRows('workoutExercises', [id])
  })
}

export async function listWorkoutExercises(workoutId: Id): Promise<WorkoutExercise[]> {
  const rows = await db.workoutExercises.where('workoutId').equals(workoutId).toArray()
  return rows.filter((r) => r.deletedAt === null).sort(byOrder)
}

export function addWorkoutSet(input: RowInput<'workoutSets'>): Promise<WorkoutSet> {
  return insertRow('workoutSets', input)
}

export function updateWorkoutSet(id: Id, patch: RowPatch<'workoutSets'>): Promise<WorkoutSet> {
  return updateRow('workoutSets', id, patch)
}

export function removeWorkoutSet(id: Id): Promise<void> {
  return softDeleteRows('workoutSets', [id])
}

export async function listWorkoutSets(workoutExerciseId: Id): Promise<WorkoutSet[]> {
  const rows = await db.workoutSets.where('workoutExerciseId').equals(workoutExerciseId).toArray()
  return rows.filter((r) => r.deletedAt === null).sort(byOrder)
}
