import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  getActiveWorkout,
  getWorkout,
  listWorkoutExercises,
  listWorkoutSets,
} from '../../data/repositories/workouts'
import { resetDb } from '../../data/testUtils'
import { seedRoutine } from './test-helpers'
import {
  addExercises,
  addSet,
  adjustRest,
  completeSet,
  discardWorkout,
  saveStaleWorkout,
  skipRest,
  startOrResumeWorkout,
} from './workout-actions'

beforeEach(async () => {
  await resetDb()
})

describe('startOrResumeWorkout', () => {
  it('copies the routine exercises, superset groups and set types into an active workout', async () => {
    const routine = await seedRoutine({
      name: 'Push',
      exercises: [
        { exerciseId: 'ex-banca', sets: [{ type: 'warmup' }, {}, {}], supersetGroup: 'g1' },
        { exerciseId: 'ex-remo', sets: 2, supersetGroup: 'g1' },
      ],
    })

    const workout = await startOrResumeWorkout(routine.id)

    expect(workout).toMatchObject({ routineId: routine.id, name: 'Push', status: 'active', restEndsAt: null })
    const exercises = await listWorkoutExercises(workout.id)
    expect(exercises.map((e) => [e.exerciseId, e.supersetGroup])).toEqual([
      ['ex-banca', 'g1'],
      ['ex-remo', 'g1'],
    ])
    expect(exercises.every((e) => e.routineExerciseId !== null)).toBe(true)
    const bancaSets = await listWorkoutSets(exercises[0]!.id)
    expect(bancaSets.map((s) => [s.type, s.completed, s.weight, s.reps])).toEqual([
      ['warmup', false, null, null],
      ['normal', false, null, null],
      ['normal', false, null, null],
    ])
    expect(await listWorkoutSets(exercises[1]!.id)).toHaveLength(2)
  })

  it('resumes the workout in progress instead of starting a second one', async () => {
    const routine = await seedRoutine({ name: 'Push', exercises: [{ exerciseId: 'ex-banca', sets: 1 }] })
    const first = await startOrResumeWorkout(routine.id)
    const again = await startOrResumeWorkout(null)
    expect(again.id).toBe(first.id)
    expect((await getActiveWorkout())?.id).toBe(first.id)
  })

  it('starts an empty free workout named "Entreno libre"', async () => {
    const w = await startOrResumeWorkout(null)
    expect(w).toMatchObject({ routineId: null, name: 'Entreno libre', status: 'active' })
    expect(await listWorkoutExercises(w.id)).toEqual([])
  })
})

describe('sets and rest', () => {
  it('addSet appends an empty set after the last one', async () => {
    const w = await startOrResumeWorkout(null)
    await addExercises(w.id, ['ex-banca'])
    const [we] = await listWorkoutExercises(w.id)
    await addSet(we!.id)
    const sets = await listWorkoutSets(we!.id)
    expect(sets).toHaveLength(2)
    expect(sets[1]).toMatchObject({ order: 1, type: 'normal', weight: null, reps: null, completed: false })
  })

  it('completeSet stores the values and sets restEndsAt from the rest seconds', async () => {
    const w = await startOrResumeWorkout(null)
    await addExercises(w.id, ['ex-banca'])
    const [we] = await listWorkoutExercises(w.id)
    const [set] = await listWorkoutSets(we!.id)
    const now = Date.parse('2026-11-19T10:00:00.000Z')

    await completeSet({ workoutId: w.id, setId: set!.id, values: { weight: 80, reps: 8, durationSec: null }, restSec: 120, now })

    expect((await listWorkoutSets(we!.id))[0]).toMatchObject({
      weight: 80,
      reps: 8,
      completed: true,
      completedAt: '2026-11-19T10:00:00.000Z',
    })
    expect((await getWorkout(w.id))?.restEndsAt).toBe('2026-11-19T10:02:00.000Z')
  })

  it('adjustRest moves the end by ±15 s and never below now; skipRest clears it', async () => {
    const w = await startOrResumeWorkout(null)
    const now = Date.parse('2026-11-19T10:00:00.000Z')
    const { updateWorkout } = await import('../../data/repositories/workouts')
    await updateWorkout(w.id, { restEndsAt: '2026-11-19T10:00:20.000Z' })

    await adjustRest(w.id, 15, now)
    expect((await getWorkout(w.id))?.restEndsAt).toBe('2026-11-19T10:00:35.000Z')
    await adjustRest(w.id, -15, now)
    await adjustRest(w.id, -15, now)
    // 10:00:05 → 9:59:50 would be in the past: the rest ends now.
    await adjustRest(w.id, -15, now)
    expect((await getWorkout(w.id))?.restEndsAt).toBeNull()

    await updateWorkout(w.id, { restEndsAt: '2026-11-19T10:01:00.000Z' })
    await skipRest(w.id)
    expect((await getWorkout(w.id))?.restEndsAt).toBeNull()
  })
})

describe('closing a workout', () => {
  it('discardWorkout marks it discarded', async () => {
    const w = await startOrResumeWorkout(null)
    await discardWorkout(w.id)
    expect(await getWorkout(w.id)).toMatchObject({ status: 'discarded' })
    expect(await getActiveWorkout()).toBeUndefined()
  })

  it('saveStaleWorkout finishes it with the last set time as end (F5)', async () => {
    const w = await startOrResumeWorkout(null)
    await addExercises(w.id, ['ex-banca'])
    const [we] = await listWorkoutExercises(w.id)
    const [set] = await listWorkoutSets(we!.id)
    await completeSet({
      workoutId: w.id,
      setId: set!.id,
      values: { weight: 80, reps: 8, durationSec: null },
      restSec: 60,
      now: Date.parse('2026-11-19T08:30:00.000Z'),
    })

    await saveStaleWorkout(w.id)

    expect(await getWorkout(w.id)).toMatchObject({
      status: 'finished',
      endedAt: '2026-11-19T08:30:00.000Z',
      restEndsAt: null,
    })
  })
})
