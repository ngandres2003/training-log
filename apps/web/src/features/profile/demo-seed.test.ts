import 'fake-indexeddb/auto'
import { rowProblem } from '@training-log/contract'
import { beforeEach, describe, expect, it } from 'vitest'
import { pendingEntries } from '../../data/outbox'
import { listLive } from '../../data/repositories/base'
import { resetDb } from '../../data/testUtils'
import { seedDemoData } from './demo-seed'

beforeEach(resetDb)

describe('demo seed', () => {
  it('creates a PPL program and about four months of finished workouts that push as valid rows', async () => {
    const now = new Date('2026-11-20T12:00:00')
    const result = await seedDemoData({ now })

    const workouts = await listLive('workouts')
    expect(result.routines).toBe(3)
    expect(workouts).toHaveLength(result.workouts)
    expect(result.workouts).toBeGreaterThan(40)
    expect(workouts.every((w) => w.status === 'finished' && w.endedAt! > w.startedAt)).toBe(true)
    const first = Math.min(...workouts.map((w) => Date.parse(w.startedAt)))
    expect((now.getTime() - first) / 86_400_000).toBeGreaterThan(110)
    expect(workouts.some((w) => w.routineId === null)).toBe(true)

    // Rest is per workout exercise, copied from the routine (some exercises have none).
    const routineExercises = await listLive('routineExercises')
    const workoutExercises = await listLive('workoutExercises')
    for (const we of workoutExercises.filter((w) => w.routineExerciseId)) {
      expect(we.restSec).toBe(routineExercises.find((r) => r.id === we.routineExerciseId)!.restSec)
    }
    expect(workoutExercises.some((we) => we.restSec === null)).toBe(true)

    expect(await listLive('workoutSets')).toHaveLength(result.sets)
    for (const e of await pendingEntries()) expect(rowProblem(e.table, e.row)).toBeNull()
  })

  it('is deterministic for a seed', async () => {
    const now = new Date('2026-11-20T12:00:00')
    const a = await seedDemoData({ now, seed: 7 })
    await resetDb()
    expect(await seedDemoData({ now, seed: 7 })).toEqual(a)
  })
})
