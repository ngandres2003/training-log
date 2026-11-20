import { describe, expect, it } from 'vitest'
import { exerciseSessions, type WorkoutTables } from './history'
import {
  exerciseSessionPoints,
  featuredExercises,
  movementBalance,
  muscleSets,
  periodRanges,
  progressKpis,
  progressSessions,
  recordEvents,
  weeklyFrequency,
  weeklyVolume,
  weeksIn,
  type ExerciseInfo,
} from './progress'
import { workout, workoutExercise, workoutSet } from './test-fixtures'
import type { WorkoutSet } from './types'

const INFO: Record<string, ExerciseInfo> = {
  bench: { trackingType: 'weight_reps', primaryMuscle: 'chest', secondaryMuscles: ['triceps'] },
  row: { trackingType: 'weight_reps', primaryMuscle: 'middle_back', secondaryMuscles: ['biceps'] },
  squat: { trackingType: 'weight_reps', primaryMuscle: 'quadriceps', secondaryMuscles: ['glutes'] },
  dips: { trackingType: 'reps', primaryMuscle: 'triceps', secondaryMuscles: [] },
  plank: { trackingType: 'time', primaryMuscle: 'abdominals', secondaryMuscles: [] },
}
const lookup = (id: string) => INFO[id]

interface Spec {
  startedAt: string
  minutes?: number
  routineId?: string | null
  energy?: number | null
  exercises: Record<string, Partial<WorkoutSet>[]>
}

/** Workout tables from finished sessions with several exercises each. */
function tables(specs: Spec[]): WorkoutTables {
  const t: WorkoutTables = { workouts: [], workoutExercises: [], workoutSets: [] }
  for (const s of specs) {
    const endedAt = new Date(Date.parse(s.startedAt) + (s.minutes ?? 60) * 60_000).toISOString()
    const w = workout({
      startedAt: s.startedAt,
      endedAt,
      routineId: s.routineId ?? null,
      energy: s.energy ?? null,
    })
    t.workouts.push(w)
    Object.entries(s.exercises).forEach(([exerciseId, sets], i) => {
      const we = workoutExercise({ workoutId: w.id, exerciseId, order: i })
      t.workoutExercises.push(we)
      sets.forEach((set, order) =>
        t.workoutSets.push(workoutSet({ workoutExerciseId: we.id, order, ...set })),
      )
    })
  }
  return t
}

const TZ = 'UTC'
const bench = (weight: number, reps: number, extra: Partial<WorkoutSet> = {}) => ({
  weight,
  reps,
  ...extra,
})

describe('periodRanges', () => {
  it('compares against the immediately preceding period of equal length', () => {
    expect(periodRanges('4w', '2026-11-20', null)).toEqual({
      current: { from: '2026-10-24', to: '2026-11-20' },
      previous: { from: '2026-09-26', to: '2026-10-23' },
    })
    const { current, previous } = periodRanges('3m', '2026-11-20', null)
    expect(weeksIn(current)).toBe(13)
    expect(previous!.to).toBe('2026-08-21')
    expect(weeksIn(previous!)).toBe(13)
  })

  it('"Todo" starts at the first trained day and has no previous period', () => {
    expect(periodRanges('all', '2026-11-20', '2026-01-05')).toEqual({
      current: { from: '2026-01-05', to: '2026-11-20' },
      previous: null,
    })
  })
})

describe('progressKpis', () => {
  const ranges = periodRanges('4w', '2026-11-20', null)

  it('gives each KPI its delta against the preceding period of equal length', () => {
    const data = tables([
      // Previous period: one session of 60 min, 2 sets, 1000 kg.
      { startedAt: '2026-10-10T10:00:00Z', exercises: { bench: [bench(50, 10), bench(50, 10)] } },
      // Current period: two sessions, 45 and 75 min, 5 sets, 1800 kg.
      {
        startedAt: '2026-11-01T10:00:00Z',
        minutes: 45,
        exercises: { bench: [bench(60, 10), bench(60, 10)] },
      },
      {
        startedAt: '2026-11-18T10:00:00Z',
        minutes: 75,
        exercises: { bench: [bench(60, 10)], squat: [bench(0, 5), bench(0, 5)] },
      },
      // Before the previous period: ignored.
      { startedAt: '2026-08-01T10:00:00Z', exercises: { bench: [bench(500, 10)] } },
    ])
    const kpis = progressKpis(progressSessions(data, TZ), lookup, ranges)
    expect(kpis.workouts).toEqual({ value: 2, delta: 1 })
    expect(kpis.sets).toEqual({ value: 5, delta: 3 })
    expect(kpis.volume).toEqual({ value: 1800, delta: 800 })
    expect(kpis.avgMinutes).toEqual({ value: 60, delta: 0 })
  })

  it('with a single session shows values but no delta (no division by zero)', () => {
    const data = tables([
      { startedAt: '2026-11-18T10:00:00Z', exercises: { bench: [bench(60, 10)] } },
    ])
    const kpis = progressKpis(progressSessions(data, TZ), lookup, ranges)
    expect(kpis.workouts).toEqual({ value: 1, delta: null })
    expect(kpis.volume).toEqual({ value: 600, delta: null })
    expect(kpis.avgMinutes).toEqual({ value: 60, delta: null })
    for (const kpi of Object.values(kpis)) expect(Number.isFinite(kpi.value ?? 0)).toBe(true)
  })

  it('with no sessions returns zeros, no average duration and no deltas', () => {
    const kpis = progressKpis([], lookup, ranges)
    expect(kpis).toEqual({
      workouts: { value: 0, delta: null },
      volume: { value: 0, delta: null },
      avgMinutes: { value: null, delta: null },
      sets: { value: 0, delta: null },
    })
  })

  it('"Todo" has no delta', () => {
    const data = tables([
      { startedAt: '2026-10-10T10:00:00Z', exercises: { bench: [bench(50, 10)] } },
      { startedAt: '2026-11-18T10:00:00Z', exercises: { bench: [bench(60, 10)] } },
    ])
    const kpis = progressKpis(
      progressSessions(data, TZ),
      lookup,
      periodRanges('all', '2026-11-20', '2026-10-10'),
    )
    expect(kpis.workouts).toEqual({ value: 2, delta: null })
  })
})

describe('warm-up sets', () => {
  it('are excluded from every progress metric', () => {
    const warm = { type: 'warmup' as const }
    const data = tables([
      {
        startedAt: '2026-11-02T10:00:00Z',
        exercises: {
          bench: [bench(40, 10, warm), bench(60, 10)],
          plank: [{ durationSec: 30, ...warm }],
        },
      },
      {
        startedAt: '2026-11-16T10:00:00Z',
        exercises: { bench: [bench(140, 1, warm), bench(60, 8)], squat: [bench(60, 5, warm)] },
      },
    ])
    const sessions = progressSessions(data, TZ)
    const range = periodRanges('4w', '2026-11-20', null)

    const kpis = progressKpis(sessions, lookup, range)
    expect(kpis.sets.value).toBe(2)
    expect(kpis.volume.value).toBe(600 + 480)
    expect(kpis.workouts.value).toBe(2) // a session still counts as a workout
    expect(
      weeklyVolume(sessions, lookup, range.current, 'monday').reduce((a, w) => a + w.volume, 0),
    ).toBe(1080)
    expect(Object.fromEntries(muscleSets(sessions, lookup, range.current))).toEqual({
      chest: 2,
      triceps: 1,
    })
    expect(movementBalance(sessions, lookup, range.current)).toEqual({
      push: 100,
      pull: 0,
      legs: 0,
      core: 0,
    })
    expect(featuredExercises(sessions, range.current)).toEqual([{ exerciseId: 'bench', sets: 2 }])

    // The 140 kg warm-up single is not a record and not the max weight.
    expect(recordEvents(sessions, lookup)).toEqual([])
    const points = exerciseSessionPoints(exerciseSessions('bench', data), 'weight_reps')
    expect(points.map((p) => p.maxWeight)).toEqual([60, 60])
    expect(exerciseSessionPoints(exerciseSessions('squat', data), 'weight_reps')).toEqual([])
  })
})

describe('muscleSets', () => {
  it('adds 1 to the primary muscle and 0.5 to each secondary muscle per set', () => {
    const data = tables([
      { startedAt: '2026-11-18T10:00:00Z', exercises: { bench: [bench(60, 10)] } },
    ])
    const sets = muscleSets(progressSessions(data, TZ), lookup, {
      from: '2026-11-16',
      to: '2026-11-22',
    })
    expect(Object.fromEntries(sets)).toEqual({ chest: 1, triceps: 0.5 })
  })

  it('only counts sessions inside the range and skips unknown exercises', () => {
    const data = tables([
      { startedAt: '2026-11-10T10:00:00Z', exercises: { bench: [bench(60, 10)] } },
      {
        startedAt: '2026-11-18T10:00:00Z',
        exercises: { row: [bench(60, 10), bench(60, 10)], mystery: [bench(1, 1)] },
      },
    ])
    const sets = muscleSets(progressSessions(data, TZ), lookup, {
      from: '2026-11-16',
      to: '2026-11-22',
    })
    expect(Object.fromEntries(sets)).toEqual({ middle_back: 2, biceps: 1 })
  })
})

describe('weekly charts', () => {
  const range = { from: '2026-11-02', to: '2026-11-20' } // three Monday weeks

  it('weeklyVolume buckets volume per week, including empty weeks', () => {
    const data = tables([
      { startedAt: '2026-11-02T10:00:00Z', exercises: { bench: [bench(60, 10)] } },
      {
        startedAt: '2026-11-04T10:00:00Z',
        exercises: { dips: [bench(10, 10)], plank: [{ durationSec: 60 }] },
      },
      { startedAt: '2026-11-19T10:00:00Z', exercises: { bench: [bench(50, 10)] } },
    ])
    expect(weeklyVolume(progressSessions(data, TZ), lookup, range, 'monday')).toEqual([
      { week: '2026-11-02', volume: 700 },
      { week: '2026-11-09', volume: 0 },
      { week: '2026-11-16', volume: 500 },
    ])
  })

  it('weeklyFrequency counts distinct trained days per week', () => {
    const data = tables([
      { startedAt: '2026-11-02T08:00:00Z', exercises: { bench: [bench(60, 10)] } },
      { startedAt: '2026-11-02T19:00:00Z', exercises: { squat: [bench(60, 10)] } },
      { startedAt: '2026-11-05T10:00:00Z', exercises: { bench: [bench(60, 10)] } },
    ])
    expect(weeklyFrequency(progressSessions(data, TZ), range, 'monday')).toEqual([
      { week: '2026-11-02', days: 2 },
      { week: '2026-11-09', days: 0 },
      { week: '2026-11-16', days: 0 },
    ])
  })
})

describe('movementBalance', () => {
  it('splits sets by the movement pattern of the primary muscle, in % of the total', () => {
    const data = tables([
      {
        startedAt: '2026-11-18T10:00:00Z',
        exercises: {
          bench: [bench(60, 10), bench(60, 10)],
          row: [bench(60, 10)],
          squat: [bench(60, 10)],
        },
      },
    ])
    const range = { from: '2026-11-16', to: '2026-11-22' }
    expect(movementBalance(progressSessions(data, TZ), lookup, range)).toEqual({
      push: 50,
      pull: 25,
      legs: 25,
      core: 0,
    })
    expect(movementBalance([], lookup, range)).toBeNull()
  })
})

describe('featuredExercises', () => {
  it('are the 5 exercises with the most completed sets in the period', () => {
    const many = (n: number) => Array.from({ length: n }, () => bench(10, 10))
    const data = tables([
      // Outside the period: would make "e7" the leader.
      { startedAt: '2026-09-01T10:00:00Z', exercises: { e7: many(30) } },
      {
        startedAt: '2026-11-18T10:00:00Z',
        exercises: {
          e1: many(6),
          e2: many(2),
          e3: many(5),
          e4: [...many(3), bench(10, 10, { completed: false })],
          e5: many(4),
          e6: many(1),
          e7: many(1),
        },
      },
    ])
    const featured = featuredExercises(progressSessions(data, TZ), {
      from: '2026-10-24',
      to: '2026-11-20',
    })
    expect(featured).toEqual([
      { exerciseId: 'e1', sets: 6 },
      { exerciseId: 'e3', sets: 5 },
      { exerciseId: 'e5', sets: 4 },
      { exerciseId: 'e4', sets: 3 },
      { exerciseId: 'e2', sets: 2 },
    ])
  })
})

describe('recordEvents', () => {
  it('lists PRs from the second session on, newest first, one per set', () => {
    const data = tables([
      {
        startedAt: '2026-11-01T10:00:00Z',
        exercises: { squat: [bench(100, 5), bench(90, 5)], plank: [{ durationSec: 60 }] },
      },
      {
        startedAt: '2026-11-08T10:00:00Z',
        exercises: { squat: [bench(102.5, 5), bench(90, 6)], plank: [{ durationSec: 50 }] },
      },
      { startedAt: '2026-11-15T10:00:00Z', exercises: { plank: [{ durationSec: 75 }] } },
    ])
    const events = recordEvents(progressSessions(data, TZ), lookup)
    expect(events.map((e) => [e.exerciseId, e.kind, e.startedAt])).toEqual([
      ['plank', 'max_duration', '2026-11-15T10:00:00Z'],
      ['squat', 'max_weight', '2026-11-08T10:00:00Z'],
      ['squat', 'reps_at_weight', '2026-11-08T10:00:00Z'],
    ])
  })
})

describe('exerciseSessionPoints (V11)', () => {
  it('gives e1RM, max weight and volume per session for weight exercises', () => {
    const data = tables([
      {
        startedAt: '2026-11-01T10:00:00Z',
        routineId: 'push',
        exercises: { bench: [bench(60, 10), bench(65, 5)] },
      },
      {
        startedAt: '2026-11-08T10:00:00Z',
        routineId: 'full',
        exercises: { bench: [bench(80, 15)] },
      },
    ])
    const points = exerciseSessionPoints(exerciseSessions('bench', data), 'weight_reps')
    expect(points).toHaveLength(2)
    expect(points[0]).toMatchObject({ routineId: 'push', maxWeight: 65, volume: 925, e1rm: 80 })
    // 15 reps is past the e1RM limit.
    expect(points[1]).toMatchObject({ routineId: 'full', maxWeight: 80, volume: 1200, e1rm: null })
  })

  it('gives max reps and added load for reps exercises and duration for time exercises', () => {
    const data = tables([
      {
        startedAt: '2026-11-01T10:00:00Z',
        exercises: {
          dips: [
            { reps: 12, weight: null },
            { reps: 8, weight: 10 },
          ],
        },
      },
      {
        startedAt: '2026-11-02T10:00:00Z',
        exercises: { plank: [{ durationSec: 45 }, { durationSec: 90 }] },
      },
    ])
    expect(exerciseSessionPoints(exerciseSessions('dips', data), 'reps')[0]).toMatchObject({
      maxReps: 12,
      maxAddedLoad: 10,
      volume: 80,
    })
    expect(exerciseSessionPoints(exerciseSessions('plank', data), 'time')[0]).toMatchObject({
      maxDuration: 90,
      volume: 0,
    })
  })
})

describe('progressSessions', () => {
  it('keeps finished, live workouts oldest first with their working sets', () => {
    const data = tables([
      {
        startedAt: '2026-11-08T10:00:00Z',
        exercises: { bench: [bench(60, 10), bench(60, 10, { completed: false })] },
      },
      { startedAt: '2026-11-01T10:00:00Z', exercises: { bench: [bench(60, 10)] } },
      { startedAt: '2026-11-09T10:00:00Z', exercises: { bench: [bench(60, 10)] } },
    ])
    data.workouts[2]!.status = 'active'
    const sessions = progressSessions(data, TZ)
    expect(sessions.map((s) => s.day)).toEqual(['2026-11-01', '2026-11-08'])
    expect(sessions[1]!.exercises[0]!.sets).toHaveLength(1)
  })
})
