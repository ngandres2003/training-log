import { exerciseSessions, type Id, type Workout } from '@training-log/domain'
import { newId, nowIso } from '../../data/ids'
import { inWriteTransaction, listLive } from '../../data/repositories/base'
import { getRoutine, listRoutineExercises, listRoutineSets } from '../../data/repositories/routines'
import {
  addWorkoutExercise,
  addWorkoutSet,
  getActiveWorkout,
  getWorkout,
  listWorkoutExercises,
  listWorkoutSets,
  removeWorkoutExercise,
  removeWorkoutSet,
  startWorkout,
  updateWorkout,
  updateWorkoutExercise,
  updateWorkoutSet,
} from '../../data/repositories/workouts'

/**
 * Writes of the active workout (V5/V6). The workout is a normal `status: active` row (KTD9);
 * every edit goes straight to Dexie, so closing or reloading the app loses nothing.
 *
 * Set values stay `null` until the user types or confirms them: V5 shows the R18 prefill as
 * a grey placeholder and ✓ stores it (see view-model `suggestion`).
 */

export const FREE_WORKOUT_NAME = 'Entreno libre'

/** Workouts open longer than this are offered to be saved with the last set time as end (F5). */
export const STALE_WORKOUT_MS = 6 * 60 * 60 * 1000

const WORKOUT_TABLES = ['workouts', 'workoutExercises', 'workoutSets'] as const
const ROUTINE_TABLES = ['routines', 'routineExercises', 'routineSets'] as const

const emptySet = (workoutExerciseId: Id, order: number, type: 'warmup' | 'normal' | 'drop' | 'failure' = 'normal') => ({
  workoutExerciseId,
  order,
  type,
  weight: null,
  reps: null,
  durationSec: null,
  rpe: null,
  completed: false,
  completedAt: null,
})

/**
 * Resumes the active workout, or starts one for the routine (null = free workout) copying its
 * exercises and planned sets (spec data model: the copy keeps history intact if the routine changes).
 */
export function startOrResumeWorkout(routineId: Id | null): Promise<Workout> {
  return inWriteTransaction([...WORKOUT_TABLES, ...ROUTINE_TABLES], async () => {
    const active = await getActiveWorkout()
    if (active) return active
    const routine = routineId ? await getRoutine(routineId) : undefined
    const workout = await startWorkout({ routineId: routine?.id ?? null, name: routine?.name ?? FREE_WORKOUT_NAME })
    if (!routine) return workout
    for (const re of await listRoutineExercises(routine.id)) {
      const we = await addWorkoutExercise({
        workoutId: workout.id,
        exerciseId: re.exerciseId,
        routineExerciseId: re.id,
        order: re.order,
        restSec: re.restSec,
        note: '',
        supersetGroup: re.supersetGroup,
      })
      for (const rs of await listRoutineSets(re.id)) {
        await addWorkoutSet(emptySet(we.id, rs.order, rs.type))
      }
    }
    return workout
  })
}

const nextOrder = (rows: { order: number }[]) => rows.reduce((max, r) => Math.max(max, r.order + 1), 0)

/**
 * Appends exercises picked in V4. Each gets as many rows as its last session in the same context
 * (this routine, or free workouts), or one row without history.
 */
export function addExercises(workoutId: Id, exerciseIds: Id[]): Promise<void> {
  return inWriteTransaction([...WORKOUT_TABLES], async () => {
    const workout = await getWorkout(workoutId)
    if (!workout) return
    const [workouts, workoutExercises, workoutSets] = await Promise.all([
      listLive('workouts'),
      listLive('workoutExercises'),
      listLive('workoutSets'),
    ])
    let order = nextOrder(await listWorkoutExercises(workoutId))
    for (const exerciseId of exerciseIds) {
      const sessions = exerciseSessions(exerciseId, { workouts, workoutExercises, workoutSets })
      const last = sessions.findLast((s) => s.routineId === workout.routineId)
      const we = await addWorkoutExercise({
        workoutId,
        exerciseId,
        routineExerciseId: null,
        order: order++,
        restSec: null,
        note: '',
        supersetGroup: null,
      })
      const rows = Math.max(1, last?.sets.length ?? 0)
      for (let i = 0; i < rows; i++) await addWorkoutSet(emptySet(we.id, i))
    }
  })
}

export async function addSet(workoutExerciseId: Id): Promise<void> {
  const sets = await listWorkoutSets(workoutExerciseId)
  await addWorkoutSet(emptySet(workoutExerciseId, nextOrder(sets)))
}

export const deleteSet = (setId: Id) => removeWorkoutSet(setId)

export type SetPatch = Partial<{
  weight: number | null
  reps: number | null
  durationSec: number | null
  rpe: number | null
}>

export const saveSet = (setId: Id, patch: SetPatch) => updateWorkoutSet(setId, patch).then(() => undefined)

/** ✓: stores the shown values, marks the set and starts this exercise's rest (R20: no special superset logic). */
export function completeSet(input: {
  workoutId: Id
  setId: Id
  values: SetPatch
  /** The exercise's rest; null or 0 = no rest timer. */
  restSec: number | null
  now?: number
}): Promise<void> {
  const now = input.now ?? Date.now()
  return inWriteTransaction([...WORKOUT_TABLES], async () => {
    await updateWorkoutSet(input.setId, {
      ...input.values,
      completed: true,
      completedAt: new Date(now).toISOString(),
    })
    await updateWorkout(input.workoutId, {
      restEndsAt: input.restSec && input.restSec > 0 ? new Date(now + input.restSec * 1000).toISOString() : null,
    })
  })
}

export const uncompleteSet = (setId: Id) =>
  updateWorkoutSet(setId, { completed: false, completedAt: null }).then(() => undefined)

/** −15 s / +15 s on the running rest; reaching now ends it. */
export function adjustRest(workoutId: Id, deltaSec: number, now: number = Date.now()): Promise<void> {
  return inWriteTransaction(['workouts'], async () => {
    const workout = await getWorkout(workoutId)
    if (!workout?.restEndsAt) return
    const end = Math.max(Date.parse(workout.restEndsAt), now) + deltaSec * 1000
    await updateWorkout(workoutId, { restEndsAt: end > now ? new Date(end).toISOString() : null })
  })
}

export const skipRest = (workoutId: Id) => updateWorkout(workoutId, { restEndsAt: null }).then(() => undefined)

// Exercise menu (spec V5: reemplazar, quitar, superserie, nota de hoy)

export const replaceExercise = (workoutExerciseId: Id, exerciseId: Id) =>
  updateWorkoutExercise(workoutExerciseId, { exerciseId }).then(() => undefined)

export const removeExercise = (workoutExerciseId: Id) => removeWorkoutExercise(workoutExerciseId)

export const saveExerciseNote = (workoutExerciseId: Id, note: string) =>
  updateWorkoutExercise(workoutExerciseId, { note }).then(() => undefined)

/** Rest after each set of this exercise; null or 0 = no rest timer. The next ✓ uses it. */
export const saveExerciseRest = (workoutExerciseId: Id, restSec: number | null) =>
  updateWorkoutExercise(workoutExerciseId, { restSec: restSec && restSec > 0 ? restSec : null }).then(() => undefined)

/** Groups the exercise with the next one, or takes it out of its superset. */
export function toggleSuperset(workoutId: Id, workoutExerciseId: Id): Promise<void> {
  return inWriteTransaction(['workoutExercises'], async () => {
    const exercises = await listWorkoutExercises(workoutId)
    const i = exercises.findIndex((e) => e.id === workoutExerciseId)
    const current = exercises[i]
    if (!current) return
    if (current.supersetGroup) {
      await updateWorkoutExercise(current.id, { supersetGroup: null })
      const rest = exercises.filter((e) => e.id !== current.id && e.supersetGroup === current.supersetGroup)
      if (rest.length === 1) await updateWorkoutExercise(rest[0]!.id, { supersetGroup: null })
      return
    }
    const next = exercises[i + 1]
    if (!next) return
    const group = next.supersetGroup ?? newId()
    await updateWorkoutExercise(current.id, { supersetGroup: group })
    if (!next.supersetGroup) await updateWorkoutExercise(next.id, { supersetGroup: group })
  })
}

// Leaving the workout

export const discardWorkout = (workoutId: Id) =>
  updateWorkout(workoutId, { status: 'discarded', endedAt: nowIso(), restEndsAt: null }).then(() => undefined)

/** Time of the last completed set, or null. */
export async function lastSetTime(workoutId: Id): Promise<string | null> {
  let last: string | null = null
  for (const we of await listWorkoutExercises(workoutId)) {
    for (const s of await listWorkoutSets(we.id)) {
      if (s.completedAt && (!last || s.completedAt > last)) last = s.completedAt
    }
  }
  return last
}

/** F5: saves a workout left open more than 6 hours, ending it at its last set. */
export function saveStaleWorkout(workoutId: Id): Promise<void> {
  return inWriteTransaction([...WORKOUT_TABLES], async () => {
    const workout = await getWorkout(workoutId)
    if (!workout) return
    const endedAt = (await lastSetTime(workoutId)) ?? workout.startedAt
    await updateWorkout(workoutId, { status: 'finished', endedAt, restEndsAt: null })
  })
}

export const isStale = (workout: Pick<Workout, 'startedAt'>, now: number) =>
  now - Date.parse(workout.startedAt) > STALE_WORKOUT_MS
