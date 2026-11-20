import {
  detectPr,
  lastRoutineSession,
  nextPendingSet,
  otherRoutineChip,
  pairPrevious,
  totalVolume,
  exerciseSessions,
  type Exercise,
  type ExerciseSession,
  type Id,
  type OtherRoutineChip,
  type Prefill,
  type PrKind,
  type RoutineExercise,
  type RoutineSet,
  type SetValues,
  type TrackingType,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
  type WorkoutTables,
} from '@training-log/domain'
import { listLive } from '../../data/repositories/base'
import { getWorkout } from '../../data/repositories/workouts'
import { getSettings, DEFAULT_SETTINGS } from '../../data/repositories/settings'
import type { RowInput } from '../../data/repositories/base'

export type SettingsValues = RowInput<'settings'>

/** Everything V5/V6 read, loaded in one live query. */
export interface WorkoutData {
  workout: Workout
  settings: SettingsValues
  exercises: WorkoutExercise[]
  setsByExercise: Map<Id, WorkoutSet[]>
  routineExercises: Map<Id, RoutineExercise>
  routineSetsByExercise: Map<Id, RoutineSet[]>
  tables: WorkoutTables
}

const byOrder = <R extends { order: number }>(a: R, b: R) => a.order - b.order

function groupBy<T>(rows: T[], key: (r: T) => Id): Map<Id, T[]> {
  const map = new Map<Id, T[]>()
  for (const r of rows) {
    const list = map.get(key(r)) ?? []
    list.push(r)
    map.set(key(r), list)
  }
  return map
}

export async function loadWorkoutData(workoutId: Id): Promise<WorkoutData | null> {
  const workout = await getWorkout(workoutId)
  if (!workout) return null
  const [settings, workouts, workoutExercises, workoutSets, routineExercises, routineSets] = await Promise.all([
    getSettings(),
    listLive('workouts'),
    listLive('workoutExercises'),
    listLive('workoutSets'),
    workout.routineId ? listLive('routineExercises', (r) => r.routineId === workout.routineId) : [],
    listLive('routineSets'),
  ])
  const exercises = workoutExercises.filter((e) => e.workoutId === workoutId).sort(byOrder)
  const ids = new Set(exercises.map((e) => e.id))
  const setsByExercise = groupBy(
    workoutSets.filter((s) => ids.has(s.workoutExerciseId)).sort(byOrder),
    (s) => s.workoutExerciseId,
  )
  const reIds = new Set(routineExercises.map((r) => r.id))
  return {
    workout,
    settings: settings ?? DEFAULT_SETTINGS,
    exercises,
    setsByExercise,
    routineExercises: new Map(routineExercises.map((r) => [r.id, r])),
    routineSetsByExercise: groupBy(
      routineSets.filter((s) => reIds.has(s.routineExerciseId)).sort(byOrder),
      (s) => s.routineExerciseId,
    ),
    tables: { workouts, workoutExercises, workoutSets },
  }
}

// Pure model

export interface SetModel {
  set: WorkoutSet
  /** 0-based row position within the exercise. */
  index: number
  /** Visual row label: "C" for warm-ups, "D" drop, "F" failure, else 1, 2, 3… */
  label: string
  /** R18 "Anterior": row N of the last session of this routine; null renders "—". */
  previous: SetValues | null
  /** Grey value shown until the user types; ✓ stores it. */
  suggestion: Prefill | null
  /** Values ✓ would store now (typed value, else suggestion). */
  effective: Prefill
  /** Record this completed set beat (one badge per set, R22). */
  pr: PrKind | null
}

export interface ExerciseModel {
  we: WorkoutExercise
  exercise: Exercise | undefined
  name: string
  trackingType: TrackingType
  /** Rest after each set (seconds); null = no rest timer. Lives on the workout exercise. */
  restSec: number | null
  /** Fixed note from the routine. */
  fixedNote: string
  sets: SetModel[]
  chip: OtherRoutineChip | null
  /** Workout names for the chip lines. */
  chipNames: { recent: string; best: string } | null
  /** Superset letter (A, B…) or null. */
  letter: string | null
  sessions: ExerciseSession[]
}

export interface BlockModel {
  exercises: ExerciseModel[]
  superset: boolean
}

export interface NextModel {
  exercise: ExerciseModel
  set: SetModel
  blockIndex: number
  /** 1-based round in a superset; row number otherwise. */
  round: number
  rounds: number
}

export interface WorkoutModel {
  workout: Workout
  settings: SettingsValues
  exercises: ExerciseModel[]
  blocks: BlockModel[]
  completed: number
  total: number
  /** kg, working sets only (domain volume). */
  volume: number
  next: NextModel | null
  lastCompleted: { exercise: ExerciseModel; set: SetModel } | null
}

const LABEL: Record<string, string> = { warmup: 'C', drop: 'D', failure: 'F' }

function routineTarget(rs: RoutineSet | undefined): Prefill | null {
  if (!rs) return null
  const reps = rs.targetRepsMax ?? rs.targetRepsMin
  if (rs.targetWeight == null && reps == null && rs.targetDurationSec == null) return null
  return { weight: rs.targetWeight, reps, durationSec: rs.targetDurationSec }
}

function blocksOf(exercises: ExerciseModel[]): ExerciseModel[][] {
  const blocks: ExerciseModel[][] = []
  for (const e of exercises) {
    const current = blocks.at(-1)
    const group = e.we.supersetGroup
    if (current && group != null && current[0]!.we.supersetGroup === group) current.push(e)
    else blocks.push([e])
  }
  return blocks
}

const completedOrder = (a: WorkoutSet, b: WorkoutSet) =>
  (a.completedAt ?? '').localeCompare(b.completedAt ?? '') || a.order - b.order

export function buildWorkoutModel(data: WorkoutData, lookup: Map<Id, Exercise>): WorkoutModel {
  const { workout, settings } = data

  const exercises: ExerciseModel[] = data.exercises.map((we) => {
    const exercise = lookup.get(we.exerciseId)
    const trackingType = exercise?.trackingType ?? 'weight_reps'
    const sets = data.setsByExercise.get(we.id) ?? []
    const sessions = exerciseSessions(we.exerciseId, data.tables, { excludeWorkoutId: workout.id })
    const last = workout.routineId
      ? lastRoutineSession(sessions, workout.routineId)
      : (sessions.findLast((s) => s.routineId === null) ?? null)
    const paired = pairPrevious(last?.sets ?? [], sets.length)
    const re = we.routineExerciseId ? data.routineExercises.get(we.routineExerciseId) : undefined
    const targets = re ? (data.routineSetsByExercise.get(re.id) ?? []) : []

    const completedSorted = sets.filter((s) => s.completed).sort(completedOrder)
    let normal = 0
    const setModels: SetModel[] = sets.map((set, index) => {
      const suggestion = (settings.preloadPrevious ? paired[index]?.prefill : null) ?? routineTarget(targets[index])
      const effective: Prefill = {
        weight: set.weight ?? suggestion?.weight ?? null,
        reps: set.reps ?? suggestion?.reps ?? null,
        durationSec: set.durationSec ?? suggestion?.durationSec ?? null,
      }
      const label = LABEL[set.type] ?? String(++normal)
      let pr: PrKind | null = null
      if (set.completed) {
        const earlier = completedSorted.slice(0, completedSorted.indexOf(set))
        pr = detectPr({ trackingType, history: sessions, earlier, candidate: set })
      }
      return { set, index, label, previous: paired[index]?.previous ?? null, suggestion, effective, pr }
    })

    // Free workouts have no routine: everything done inside a routine counts as "otra rutina".
    const chip = workout.routineId
      ? otherRoutineChip(sessions, workout.routineId, trackingType)
      : otherRoutineChip(
          sessions.filter((s) => s.routineId !== null),
          '',
          trackingType,
        )
    const nameOf = (id: Id) => sessions.find((s) => s.workoutId === id)?.workoutName ?? ''

    return {
      we,
      exercise,
      name: exercise?.name ?? 'Ejercicio',
      trackingType,
      restSec: we.restSec,
      fixedNote: re?.note ?? '',
      sets: setModels,
      chip,
      chipNames: chip ? { recent: chip.recent.workoutName, best: nameOf(chip.best.workoutId) } : null,
      letter: null,
      sessions,
    }
  })

  const blocks: BlockModel[] = blocksOf(exercises).map((list) => {
    const superset = list.length > 1
    if (superset) list.forEach((e, i) => (e.letter = String.fromCharCode(65 + i)))
    return { exercises: list, superset }
  })

  const allSets = exercises.flatMap((e) => e.sets.map((s) => ({ exercise: e, set: s })))
  const completed = allSets.filter((x) => x.set.set.completed)

  const nextRaw = nextPendingSet(
    exercises.map((e) => ({
      id: e.we.id,
      supersetGroup: e.we.supersetGroup,
      sets: e.sets.map((s) => ({ id: s.set.id, completed: s.set.completed })),
    })),
  )
  let next: NextModel | null = null
  if (nextRaw) {
    const blockIndex = blocks.findIndex((b) => b.exercises.some((e) => e.we.id === nextRaw.exerciseId))
    const block = blocks[blockIndex]!
    const exercise = block.exercises.find((e) => e.we.id === nextRaw.exerciseId)!
    next = {
      exercise,
      set: exercise.sets[nextRaw.setIndex]!,
      blockIndex,
      round: nextRaw.setIndex + 1,
      rounds: block.superset ? Math.max(...block.exercises.map((e) => e.sets.length)) : exercise.sets.length,
    }
  }

  const lastCompleted =
    completed.length === 0
      ? null
      : completed.reduce((a, b) => (completedOrder(a.set.set, b.set.set) >= 0 ? a : b))

  return {
    workout,
    settings,
    exercises,
    blocks,
    completed: completed.length,
    total: allSets.length,
    volume: exercises.reduce(
      (sum, e) =>
        sum +
        totalVolume(
          e.sets.map((s) => s.set),
          e.trackingType,
        ),
      0,
    ),
    next,
    lastCompleted,
  }
}

/** Sets of a superset block in alternation order A1 → B1 → A2 (design: one slide, rows A1…B3). */
export function alternation(block: BlockModel): { exercise: ExerciseModel; set: SetModel }[] {
  if (!block.superset) return block.exercises[0]!.sets.map((set) => ({ exercise: block.exercises[0]!, set }))
  const rounds = Math.max(...block.exercises.map((e) => e.sets.length))
  const rows: { exercise: ExerciseModel; set: SetModel }[] = []
  for (let r = 0; r < rounds; r++) {
    for (const e of block.exercises) {
      const set = e.sets[r]
      if (set) rows.push({ exercise: e, set })
    }
  }
  return rows
}
