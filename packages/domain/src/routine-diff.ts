import type {
  Id,
  RoutineExercise,
  RoutineSet,
  SetType,
  WeightUnit,
  WorkoutExercise,
  WorkoutSet,
} from './types'
import { formatWeightValue } from './units'

/** One difference between the routine and the workout just finished (R24). Positions are 1-based. */
export type RoutineChange =
  | { kind: 'exercise_added'; exerciseId: Id; workoutExerciseId: Id }
  | { kind: 'exercise_removed'; exerciseId: Id; routineExerciseId: Id }
  | { kind: 'set_added'; exerciseId: Id; routineExerciseId: Id; position: number }
  | { kind: 'set_removed'; exerciseId: Id; routineExerciseId: Id; position: number }
  | {
      kind: 'set_type_changed'
      exerciseId: Id
      routineExerciseId: Id
      position: number
      from: SetType
      to: SetType
    }
  | {
      kind: 'weight_changed'
      exerciseId: Id
      routineExerciseId: Id
      position: number
      from: number | null
      to: number
    }

const live = <T extends { deletedAt: string | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt)
const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order

/**
 * Compares a routine with a workout of it. Rows are compared by position.
 * - Exercises: added (no routine link) or removed (routine exercise not in the workout).
 * - Sets: rows added or removed, and set type changes.
 * - Weight: a completed working row whose weight differs from the target. Warm-up rows are ignored.
 * Order: routine exercises in routine order, then added exercises in workout order.
 */
export function diffRoutine(input: {
  routineExercises: RoutineExercise[]
  routineSets: RoutineSet[]
  workoutExercises: WorkoutExercise[]
  workoutSets: WorkoutSet[]
}): RoutineChange[] {
  const changes: RoutineChange[] = []
  const workoutExercises = live(input.workoutExercises).sort(byOrder)
  const routineSets = live(input.routineSets)
  const workoutSets = live(input.workoutSets)

  for (const re of live(input.routineExercises).sort(byOrder)) {
    const ref = { exerciseId: re.exerciseId, routineExerciseId: re.id }
    const we = workoutExercises.find((e) => e.routineExerciseId === re.id)
    if (!we) {
      changes.push({ kind: 'exercise_removed', ...ref })
      continue
    }
    const planned = routineSets.filter((s) => s.routineExerciseId === re.id).sort(byOrder)
    const done = workoutSets.filter((s) => s.workoutExerciseId === we.id).sort(byOrder)

    for (let i = 0; i < Math.min(planned.length, done.length); i++) {
      const p = planned[i]!
      const d = done[i]!
      const position = i + 1
      if (p.type !== d.type) {
        changes.push({ kind: 'set_type_changed', ...ref, position, from: p.type, to: d.type })
      }
      const isWarmup = p.type === 'warmup' || d.type === 'warmup'
      if (!isWarmup && d.completed && d.weight != null && d.weight !== p.targetWeight) {
        changes.push({ kind: 'weight_changed', ...ref, position, from: p.targetWeight, to: d.weight })
      }
    }
    for (let i = planned.length; i < done.length; i++) {
      changes.push({ kind: 'set_added', ...ref, position: i + 1 })
    }
    for (let i = done.length; i < planned.length; i++) {
      changes.push({ kind: 'set_removed', ...ref, position: i + 1 })
    }
  }

  for (const we of workoutExercises) {
    if (we.routineExerciseId == null) {
      changes.push({ kind: 'exercise_added', exerciseId: we.exerciseId, workoutExerciseId: we.id })
    }
  }
  return changes
}

const SET_TYPE_LABEL: Record<SetType, string> = {
  warmup: 'calentamiento',
  normal: 'normal',
  drop: 'drop set',
  failure: 'al fallo',
}

/** Spanish line for the "¿Actualizar la rutina?" list. */
export function describeChange(
  change: RoutineChange,
  ctx: { exerciseName: (exerciseId: Id) => string; unit: WeightUnit },
): string {
  const name = ctx.exerciseName(change.exerciseId)
  switch (change.kind) {
    case 'exercise_added':
      return `Añadir ${name}`
    case 'exercise_removed':
      return `Quitar ${name}`
    case 'set_added':
      return `${name}: añadir serie ${change.position}`
    case 'set_removed':
      return `${name}: quitar serie ${change.position}`
    case 'set_type_changed':
      return `${name}: serie ${change.position} de ${SET_TYPE_LABEL[change.from]} a ${SET_TYPE_LABEL[change.to]}`
    case 'weight_changed': {
      const from = change.from == null ? '—' : formatWeightValue(change.from, ctx.unit)
      return `${name}: serie ${change.position} de ${from} a ${formatWeightValue(change.to, ctx.unit)} ${ctx.unit}`
    }
  }
}
