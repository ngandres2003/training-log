import { describe, expect, it } from 'vitest'
import { exerciseSessions } from './history'
import { history } from './test-fixtures'

describe('exerciseSessions', () => {
  it('returns finished sessions of the exercise oldest first with completed sets in order', () => {
    const data = history([
      { startedAt: '2026-01-10T10:00:00Z', routineId: 'r1', sets: [{ reps: 5, weight: 100 }] },
      { startedAt: '2026-01-03T10:00:00Z', sets: [{ reps: 8 }, { reps: 9, completed: false }] },
      { startedAt: '2026-01-12T10:00:00Z', sets: [{ reps: 1 }], status: 'active' },
      { startedAt: '2026-01-13T10:00:00Z', sets: [{ reps: 1 }], exerciseId: 'bench' },
    ])
    const sessions = exerciseSessions('squat', data)
    expect(sessions.map((s) => s.startedAt)).toEqual([
      '2026-01-03T10:00:00Z',
      '2026-01-10T10:00:00Z',
    ])
    expect(sessions[0]!.sets.map((s) => s.reps)).toEqual([8])
    expect(sessions[1]!.routineId).toBe('r1')
  })

  it('skips deleted workouts and deleted sets', () => {
    const data = history([
      {
        startedAt: '2026-01-03T10:00:00Z',
        sets: [{ reps: 8 }, { reps: 6, deletedAt: '2026-01-04T00:00:00Z' }],
      },
      { startedAt: '2026-01-05T10:00:00Z', sets: [{ reps: 5 }] },
    ])
    data.workouts[1]!.deletedAt = '2026-01-06T00:00:00Z'
    const sessions = exerciseSessions('squat', data)
    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.sets.map((s) => s.reps)).toEqual([8])
  })

  it('can exclude the workout in progress', () => {
    const data = history([
      { startedAt: '2026-01-03T10:00:00Z', sets: [{ reps: 8 }] },
      { startedAt: '2026-01-05T10:00:00Z', sets: [{ reps: 5 }] },
    ])
    const sessions = exerciseSessions('squat', data, { excludeWorkoutId: data.workouts[1]!.id })
    expect(sessions.map((s) => s.startedAt)).toEqual(['2026-01-03T10:00:00Z'])
  })
})
