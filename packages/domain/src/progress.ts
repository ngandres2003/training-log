import { addDays, daysBetween, localDayKey, weekStartOf, type DayKey } from './dates'
import type { ExerciseSession, WorkoutTables } from './history'
import { setsPerMuscle } from './muscles'
import { detectPr, type PrKind } from './records'
import type {
  ExerciseBase,
  Id,
  MuscleId,
  TrackingType,
  WeekStart,
  Workout,
  WorkoutSet,
} from './types'
import { e1rm, isWorkingSet, setVolume } from './volume'

/**
 * Progress aggregations for V10 (dashboard) and V11 (exercise detail).
 * Every metric counts completed working sets only: warm-ups are left out.
 */

export type ProgressPeriod = '4w' | '3m' | '1y' | 'all'

/** Inclusive range of local days. */
export interface DayRange {
  from: DayKey
  to: DayKey
}

/** Length in days of each bounded period. */
export const PERIOD_DAYS: Record<Exclude<ProgressPeriod, 'all'>, number> = {
  '4w': 28,
  '3m': 91,
  '1y': 365,
}

/**
 * The selected period ending today and the immediately preceding period of equal
 * length. "Todo" starts at the first trained day (today when there is none) and
 * has no previous period.
 */
export function periodRanges(
  period: ProgressPeriod,
  today: DayKey,
  firstDay: DayKey | null,
): { current: DayRange; previous: DayRange | null } {
  if (period === 'all') return { current: { from: firstDay ?? today, to: today }, previous: null }
  const days = PERIOD_DAYS[period]
  const from = addDays(today, -(days - 1))
  return {
    current: { from, to: today },
    previous: { from: addDays(from, -days), to: addDays(from, -1) },
  }
}

/** Number of weeks a range spans (at least 1). */
export const weeksIn = (range: DayRange) => Math.max(1, (daysBetween(range.from, range.to) + 1) / 7)

const inRange = (day: DayKey, range: DayRange) => day >= range.from && day <= range.to

/** What the progress metrics need to know about an exercise. */
export type ExerciseInfo = Pick<ExerciseBase, 'trackingType' | 'primaryMuscle' | 'secondaryMuscles'>
export type ExerciseInfoLookup = (exerciseId: Id) => ExerciseInfo | undefined

/** One finished workout with the working sets of each exercise, in order. */
export interface ProgressSession {
  workoutId: Id
  routineId: Id | null
  name: string
  startedAt: string
  endedAt: string | null
  energy: number | null
  /** Local day the workout started. */
  day: DayKey
  exercises: { exerciseId: Id; sets: WorkoutSet[] }[]
}

/** Finished, non-deleted workouts oldest first, keeping only completed working sets. */
export function progressSessions(
  { workouts, workoutExercises, workoutSets }: WorkoutTables,
  timeZone: string,
): ProgressSession[] {
  const setsByExercise = new Map<Id, WorkoutSet[]>()
  for (const s of workoutSets) {
    if (s.deletedAt || !isWorkingSet(s)) continue
    const list = setsByExercise.get(s.workoutExerciseId) ?? []
    list.push(s)
    setsByExercise.set(s.workoutExerciseId, list)
  }
  const exercisesByWorkout = new Map<Id, ProgressSession['exercises']>()
  for (const e of [...workoutExercises].sort((a, b) => a.order - b.order)) {
    if (e.deletedAt) continue
    const list = exercisesByWorkout.get(e.workoutId) ?? []
    const sets = (setsByExercise.get(e.id) ?? []).sort((a, b) => a.order - b.order)
    list.push({ exerciseId: e.exerciseId, sets })
    exercisesByWorkout.set(e.workoutId, list)
  }
  return workouts
    .filter((w) => w.status === 'finished' && !w.deletedAt)
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
    .map((w: Workout) => ({
      workoutId: w.id,
      routineId: w.routineId,
      name: w.name,
      startedAt: w.startedAt,
      endedAt: w.endedAt,
      energy: w.energy,
      day: localDayKey(w.startedAt, timeZone),
      exercises: exercisesByWorkout.get(w.id) ?? [],
    }))
}

const trackingOf = (lookup: ExerciseInfoLookup, id: Id): TrackingType =>
  lookup(id)?.trackingType ?? 'weight_reps'

function sessionVolume(session: ProgressSession, lookup: ExerciseInfoLookup): number {
  return session.exercises.reduce(
    (sum, e) =>
      sum + e.sets.reduce((s, set) => s + setVolume(set, trackingOf(lookup, e.exerciseId)), 0),
    0,
  )
}

const sessionSets = (session: ProgressSession) =>
  session.exercises.reduce((sum, e) => sum + e.sets.length, 0)

function sessionMinutes(session: ProgressSession): number | null {
  if (!session.endedAt) return null
  return (Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 60_000
}

/** A KPI value and its change against the previous period (null when there is nothing to compare). */
export interface Kpi {
  value: number | null
  delta: number | null
}

export interface ProgressKpis {
  workouts: Kpi
  volume: Kpi
  /** Average duration in minutes; null without finished sessions that have an end. */
  avgMinutes: Kpi
  sets: Kpi
}

function periodValues(sessions: ProgressSession[], lookup: ExerciseInfoLookup, range: DayRange) {
  const inPeriod = sessions.filter((s) => inRange(s.day, range))
  const minutes = inPeriod.flatMap((s) => {
    const m = sessionMinutes(s)
    return m == null ? [] : [m]
  })
  return {
    workouts: inPeriod.length,
    volume: inPeriod.reduce((sum, s) => sum + sessionVolume(s, lookup), 0),
    avgMinutes: minutes.length
      ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length)
      : null,
    sets: inPeriod.reduce((sum, s) => sum + sessionSets(s), 0),
  }
}

/**
 * KPI cards of V10: workouts, total volume, average duration and total sets,
 * each with its absolute change against the previous period. Deltas are hidden
 * (null) until there are at least two sessions, for "Todo", and when either
 * side has no value; nothing is ever divided by the previous value.
 */
export function progressKpis(
  sessions: ProgressSession[],
  lookup: ExerciseInfoLookup,
  ranges: { current: DayRange; previous: DayRange | null },
): ProgressKpis {
  const current = periodValues(sessions, lookup, ranges.current)
  const previous =
    ranges.previous && sessions.length >= 2 ? periodValues(sessions, lookup, ranges.previous) : null
  const kpi = (key: keyof typeof current): Kpi => {
    const value = current[key]
    const before = previous?.[key]
    return { value, delta: value == null || before == null ? null : value - before }
  }
  return {
    workouts: kpi('workouts'),
    volume: kpi('volume'),
    avgMinutes: kpi('avgMinutes'),
    sets: kpi('sets'),
  }
}

/** Start day of every week the range touches. */
function weeksOf(range: DayRange, weekStart: WeekStart): DayKey[] {
  const weeks: DayKey[] = []
  for (let w = weekStartOf(range.from, weekStart); w <= range.to; w = addDays(w, 7)) weeks.push(w)
  return weeks
}

/** Volume per week of the range, empty weeks included (V10 bar chart). */
export function weeklyVolume(
  sessions: ProgressSession[],
  lookup: ExerciseInfoLookup,
  range: DayRange,
  weekStart: WeekStart,
): { week: DayKey; volume: number }[] {
  const totals = new Map(weeksOf(range, weekStart).map((w) => [w, 0]))
  for (const s of sessions) {
    if (!inRange(s.day, range)) continue
    const week = weekStartOf(s.day, weekStart)
    totals.set(week, (totals.get(week) ?? 0) + sessionVolume(s, lookup))
  }
  return [...totals].map(([week, volume]) => ({ week, volume }))
}

/** Distinct trained days per week of the range (V10 frequency vs. weekly goal). */
export function weeklyFrequency(
  sessions: ProgressSession[],
  range: DayRange,
  weekStart: WeekStart,
): { week: DayKey; days: number }[] {
  const days = new Map(weeksOf(range, weekStart).map((w) => [w, new Set<DayKey>()]))
  for (const s of sessions) {
    if (!inRange(s.day, range)) continue
    days.get(weekStartOf(s.day, weekStart))?.add(s.day)
  }
  return [...days].map(([week, set]) => ({ week, days: set.size }))
}

/** Working sets per exercise in the range. */
function setsByExercise(sessions: ProgressSession[], range: DayRange): Map<Id, number> {
  const counts = new Map<Id, number>()
  for (const s of sessions) {
    if (!inRange(s.day, range)) continue
    for (const e of s.exercises) {
      if (e.sets.length) counts.set(e.exerciseId, (counts.get(e.exerciseId) ?? 0) + e.sets.length)
    }
  }
  return counts
}

/**
 * Sets per muscle in the range: 1 for the primary muscle and 0.5 for each
 * secondary muscle of every working set. Unknown exercises are skipped.
 */
export function muscleSets(
  sessions: ProgressSession[],
  lookup: ExerciseInfoLookup,
  range: DayRange,
): Map<MuscleId, number> {
  const entries = [...setsByExercise(sessions, range)].flatMap(([id, sets]) => {
    const info = lookup(id)
    return info
      ? [{ primaryMuscle: info.primaryMuscle, secondaryMuscles: info.secondaryMuscles, sets }]
      : []
  })
  return setsPerMuscle(entries)
}

export type MovementPattern = 'push' | 'pull' | 'legs' | 'core'

/** Movement pattern of each muscle in the fixed list, by the muscle an exercise mainly works. */
export const MOVEMENT_PATTERN: Record<MuscleId, MovementPattern> = {
  chest: 'push',
  shoulders: 'push',
  triceps: 'push',
  lats: 'pull',
  middle_back: 'pull',
  traps: 'pull',
  biceps: 'pull',
  forearms: 'pull',
  lower_back: 'pull',
  quadriceps: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  adductors: 'legs',
  abductors: 'legs',
  abdominals: 'core',
  neck: 'core',
}

/**
 * Push / pull / legs balance: working sets by the pattern of the exercise's
 * primary muscle, in % of all sets of known exercises. Null without sets.
 */
export function movementBalance(
  sessions: ProgressSession[],
  lookup: ExerciseInfoLookup,
  range: DayRange,
): Record<MovementPattern, number> | null {
  const counts: Record<MovementPattern, number> = { push: 0, pull: 0, legs: 0, core: 0 }
  for (const [id, sets] of setsByExercise(sessions, range)) {
    const muscle = lookup(id)?.primaryMuscle
    const pattern = muscle ? MOVEMENT_PATTERN[muscle] : undefined
    if (pattern) counts[pattern] += sets
  }
  const total = counts.push + counts.pull + counts.legs + counts.core
  if (total === 0) return null
  const pct = (n: number) => (n / total) * 100
  return {
    push: pct(counts.push),
    pull: pct(counts.pull),
    legs: pct(counts.legs),
    core: pct(counts.core),
  }
}

/** "Ejercicios destacados": the exercises with the most working sets in the range. */
export function featuredExercises(
  sessions: ProgressSession[],
  range: DayRange,
  limit = 5,
): { exerciseId: Id; sets: number }[] {
  return [...setsByExercise(sessions, range)]
    .map(([exerciseId, sets]) => ({ exerciseId, sets }))
    .sort((a, b) => b.sets - a.sets || a.exerciseId.localeCompare(b.exerciseId))
    .slice(0, limit)
}

/** A set that beat a record when it was done. */
export interface RecordEvent {
  exerciseId: Id
  workoutId: Id
  startedAt: string
  kind: PrKind
  set: WorkoutSet
}

/**
 * Every PR in the history, newest first, by replaying the sessions with the
 * same rule as the live badge (R22): the first session of an exercise only sets
 * its marks, and a set earns at most one record.
 */
export function recordEvents(
  sessions: ProgressSession[],
  lookup: ExerciseInfoLookup,
): RecordEvent[] {
  const pastByExercise = new Map<Id, ExerciseSession[]>()
  const events: RecordEvent[] = []
  for (const session of sessions) {
    for (const { exerciseId, sets } of session.exercises) {
      if (!sets.length) continue
      const history = pastByExercise.get(exerciseId) ?? []
      sets.forEach((candidate, i) => {
        const kind = detectPr({
          trackingType: trackingOf(lookup, exerciseId),
          history,
          earlier: sets.slice(0, i),
          candidate,
        })
        if (kind)
          events.push({
            exerciseId,
            workoutId: session.workoutId,
            startedAt: session.startedAt,
            kind,
            set: candidate,
          })
      })
      history.push({
        workoutId: session.workoutId,
        routineId: session.routineId,
        workoutName: session.name,
        startedAt: session.startedAt,
        sets,
      })
      pastByExercise.set(exerciseId, history)
    }
  }
  return events.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
}

/** One session of an exercise as V11 charts it. */
export interface ExerciseSessionPoint {
  workoutId: Id
  routineId: Id | null
  workoutName: string
  startedAt: string
  /** weight_reps: best e1RM of the session (null when no set qualifies). */
  e1rm: number | null
  maxWeight: number
  volume: number
  /** reps: most reps in a set and heaviest added load. */
  maxReps: number
  maxAddedLoad: number
  /** time: longest hold in seconds. */
  maxDuration: number
  /** Working sets of the session, in order. */
  sets: WorkoutSet[]
}

/**
 * Per-session values of an exercise for the V11 charts, oldest first. Takes the
 * output of `exerciseSessions`; warm-ups are dropped and sessions left without
 * working sets are skipped.
 */
export function exerciseSessionPoints(
  sessions: ExerciseSession[],
  trackingType: TrackingType,
): ExerciseSessionPoint[] {
  return sessions.flatMap((session) => {
    const sets = session.sets.filter(isWorkingSet)
    if (!sets.length) return []
    const e1rms = sets.flatMap((s) => {
      const v = e1rm(s.weight, s.reps)
      return v == null ? [] : [v]
    })
    return [
      {
        workoutId: session.workoutId,
        routineId: session.routineId,
        workoutName: session.workoutName,
        startedAt: session.startedAt,
        e1rm: e1rms.length ? Math.max(...e1rms) : null,
        maxWeight: Math.max(...sets.map((s) => s.weight ?? 0)),
        volume: sets.reduce((sum, s) => sum + setVolume(s, trackingType), 0),
        maxReps: Math.max(...sets.map((s) => s.reps ?? 0)),
        maxAddedLoad: Math.max(...sets.map((s) => s.weight ?? 0)),
        maxDuration: Math.max(...sets.map((s) => s.durationSec ?? 0)),
        sets,
      },
    ]
  })
}
