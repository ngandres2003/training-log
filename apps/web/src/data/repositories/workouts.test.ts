import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { pendingEntries } from '../outbox'
import { resetDb } from '../testUtils'
import {
  addWorkoutExercise,
  addWorkoutSet,
  deleteWorkout,
  getActiveWorkout,
  listWorkoutExercises,
  listWorkouts,
  startWorkout,
  updateWorkout,
} from './workouts'

beforeEach(resetDb)

describe('workouts repository', () => {
  it('the active workout is a normal row with status active', async () => {
    const w = await startWorkout({ routineId: null, name: 'Libre' })
    expect((await getActiveWorkout())?.id).toBe(w.id)

    await updateWorkout(w.id, { status: 'finished', endedAt: '2026-11-17T10:00:00.000Z' })
    expect(await getActiveWorkout()).toBeUndefined()
    expect(await db.workouts.get(w.id)).toMatchObject({ status: 'finished', version: 0 })
  })

  it('deleting a workout tombstones it with its exercises and sets and queues each', async () => {
    const w = await startWorkout({ routineId: null, name: 'Libre', startedAt: '2026-11-16T09:00:00.000Z' })
    const kept = await startWorkout({ routineId: null, name: 'Otra', startedAt: '2026-11-17T09:00:00.000Z' })
    const we = await addWorkoutExercise({
      workoutId: w.id,
      exerciseId: 'bench',
      routineExerciseId: null,
      restSec: null,
      order: 0,
      note: '',
      supersetGroup: null,
    })
    const set = await addWorkoutSet({
      workoutExerciseId: we.id,
      order: 0,
      type: 'normal',
      weight: 60,
      reps: 8,
      durationSec: null,
      rpe: null,
      completed: true,
      completedAt: '2026-11-16T09:10:00.000Z',
    })

    await deleteWorkout(w.id)

    expect((await listWorkouts()).map((x) => x.id)).toEqual([kept.id])
    expect(await listWorkoutExercises(w.id)).toEqual([])
    expect((await db.workoutSets.get(set.id))?.deletedAt).not.toBeNull()
    const deletedKeys = (await pendingEntries()).filter((e) => e.row.deletedAt !== null).map((e) => e.key)
    expect(deletedKeys.sort()).toEqual(
      [`workouts:${w.id}`, `workoutExercises:${we.id}`, `workoutSets:${set.id}`].sort(),
    )
  })
})
