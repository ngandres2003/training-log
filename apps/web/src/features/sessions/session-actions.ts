import { diffRoutine, type Id, type RoutineSet, type Workout, type WorkoutSet } from '@training-log/domain'
import { nowIso } from '../../data/ids'
import { inWriteTransaction } from '../../data/repositories/base'
import {
  addRoutineExercise,
  addRoutineSet,
  createRoutine,
  getRoutine,
  listRoutineExercises,
  listRoutineSets,
  removeRoutineExercise,
  removeRoutineSet,
  updateRoutineSet,
} from '../../data/repositories/routines'
import {
  addWorkoutExercise,
  addWorkoutSet,
  getActiveWorkout,
  getWorkout,
  listWorkoutExercises,
  listWorkoutSets,
  startWorkout,
  updateWorkout,
} from '../../data/repositories/workouts'
import { FREE_WORKOUT_NAME, startOrResumeWorkout } from '../workout/workout-actions'

const TABLES = [
  'workouts',
  'workoutExercises',
  'workoutSets',
  'routines',
  'routineExercises',
  'routineSets',
] as const

/** Target of a routine row taken from a performed set; `template` keeps the planned rep range. */
function targetFrom(set: WorkoutSet, template?: RoutineSet) {
  return {
    type: set.type,
    targetRepsMin: template ? template.targetRepsMin : set.reps,
    targetRepsMax: template ? template.targetRepsMax : set.reps,
    targetWeight: set.weight ?? template?.targetWeight ?? null,
    targetDurationSec: set.durationSec ?? template?.targetDurationSec ?? null,
  }
}

async function loadWorkoutTree(workoutId: Id) {
  const exercises = await listWorkoutExercises(workoutId)
  return Promise.all(exercises.map(async (we) => ({ we, sets: await listWorkoutSets(we.id) })))
}

/** "Sí" in V7 (R24): the routine takes the workout's exercises, rows, set types and weights. */
async function applyRoutineChanges(workout: Workout): Promise<void> {
  const routineId = workout.routineId
  if (!routineId || !(await getRoutine(routineId))) return
  const routineTree = await Promise.all(
    (await listRoutineExercises(routineId)).map(async (re) => ({ re, sets: await listRoutineSets(re.id) })),
  )
  const workoutTree = await loadWorkoutTree(workout.id)
  const changes = diffRoutine({
    routineExercises: routineTree.map((r) => r.re),
    routineSets: routineTree.flatMap((r) => r.sets),
    workoutExercises: workoutTree.map((w) => w.we),
    workoutSets: workoutTree.flatMap((w) => w.sets),
  })

  const planned = (routineExerciseId: Id) => routineTree.find((r) => r.re.id === routineExerciseId)?.sets ?? []
  const done = (routineExerciseId: Id) => workoutTree.find((w) => w.we.routineExerciseId === routineExerciseId)?.sets ?? []
  let nextExerciseOrder = routineTree.reduce((max, r) => Math.max(max, r.re.order + 1), 0)

  for (const change of changes) {
    switch (change.kind) {
      case 'exercise_removed':
        await removeRoutineExercise(change.routineExerciseId)
        break
      case 'exercise_added': {
        const performed = workoutTree.find((w) => w.we.id === change.workoutExerciseId)!
        const re = await addRoutineExercise({
          routineId,
          exerciseId: change.exerciseId,
          order: nextExerciseOrder++,
          supersetGroup: performed.we.supersetGroup,
        })
        for (const [order, s] of performed.sets.entries()) {
          await addRoutineSet({ routineExerciseId: re.id, order, ...targetFrom(s) })
        }
        break
      }
      case 'set_added': {
        const rows = planned(change.routineExerciseId)
        const order = rows.reduce((max, r) => Math.max(max, r.order + 1), 0) + (change.position - 1 - rows.length)
        const set = done(change.routineExerciseId)[change.position - 1]!
        await addRoutineSet({ routineExerciseId: change.routineExerciseId, order, ...targetFrom(set, rows.at(-1)) })
        break
      }
      case 'set_removed':
        await removeRoutineSet(planned(change.routineExerciseId)[change.position - 1]!.id)
        break
      case 'set_type_changed':
        await updateRoutineSet(planned(change.routineExerciseId)[change.position - 1]!.id, { type: change.to })
        break
      case 'weight_changed':
        await updateRoutineSet(planned(change.routineExerciseId)[change.position - 1]!.id, { targetWeight: change.to })
        break
    }
  }
}

/** "Guardar como rutina nueva" (F6): the performed exercises with their completed sets as targets. */
async function createRoutineFromWorkout(workoutId: Id, name: string) {
  const routine = await createRoutine({ name })
  let order = 0
  for (const { we, sets } of await loadWorkoutTree(workoutId)) {
    const completed = sets.filter((s) => s.completed)
    if (completed.length === 0) continue
    const re = await addRoutineExercise({
      routineId: routine.id,
      exerciseId: we.exerciseId,
      order: order++,
      supersetGroup: we.supersetGroup,
    })
    for (const [i, s] of completed.entries()) await addRoutineSet({ routineExerciseId: re.id, order: i, ...targetFrom(s) })
  }
  return routine
}

export interface FinishInput {
  workoutId: Id
  energy: number | null
  tags: string[]
  note: string
  /** "Sí" to "¿Actualizar la rutina?" (R24). */
  updateRoutine: boolean
  /** Free workouts: name of the routine to create from it, or null. */
  newRoutineName: string | null
  endedAt?: string
}

/** V7 · Guardar: closes the workout with its sensations, and updates or creates the routine. */
export function saveFinishedWorkout(input: FinishInput): Promise<void> {
  return inWriteTransaction([...TABLES], async () => {
    const workout = await getWorkout(input.workoutId)
    if (!workout || workout.status !== 'active') return
    let { routineId, name } = workout
    if (input.updateRoutine) await applyRoutineChanges(workout)
    if (!routineId && input.newRoutineName) {
      const routine = await createRoutineFromWorkout(workout.id, input.newRoutineName)
      routineId = routine.id
      name = routine.name
    }
    await updateWorkout(workout.id, {
      status: 'finished',
      endedAt: input.endedAt ?? nowIso(),
      restEndsAt: null,
      energy: input.energy,
      tags: input.tags,
      note: input.note,
      routineId,
      name,
    })
  })
}

/**
 * V8 · Repetir: resumes the active workout if there is one; otherwise starts the session's routine,
 * or, when it was free or its routine was deleted (R12), a free workout with the same exercises.
 */
export function repeatWorkout(workoutId: Id): Promise<Workout | undefined> {
  return inWriteTransaction([...TABLES], async () => {
    const active = await getActiveWorkout()
    if (active) return active
    const source = await getWorkout(workoutId)
    if (!source) return undefined
    if (source.routineId && (await getRoutine(source.routineId))) return startOrResumeWorkout(source.routineId)
    const workout = await startWorkout({ routineId: null, name: FREE_WORKOUT_NAME })
    for (const { we, sets } of await loadWorkoutTree(source.id)) {
      const copy = await addWorkoutExercise({
        workoutId: workout.id,
        exerciseId: we.exerciseId,
        routineExerciseId: null,
        order: we.order,
        note: '',
        supersetGroup: we.supersetGroup,
      })
      for (const s of sets) {
        await addWorkoutSet({
          workoutExerciseId: copy.id,
          order: s.order,
          type: s.type,
          weight: null,
          reps: null,
          durationSec: null,
          rpe: null,
          completed: false,
          completedAt: null,
        })
      }
    }
    return workout
  })
}
