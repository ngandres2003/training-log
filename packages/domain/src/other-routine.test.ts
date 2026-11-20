import { describe, expect, it } from 'vitest'
import { exerciseSessions } from './history'
import { otherRoutineChip } from './other-routine'
import { history } from './test-fixtures'

describe('otherRoutineChip (R19)', () => {
  it('Covers AE8. returns null when squat was never done outside this routine', () => {
    const sessions = exerciseSessions(
      'squat',
      history([
        { routineId: 'legs', startedAt: '2026-01-01T10:00:00Z', sets: [{ weight: 100, reps: 5 }] },
      ]),
    )
    expect(otherRoutineChip(sessions, 'legs', 'weight_reps')).toBeNull()
  })

  it('shows the latest outside session best set and the best e1RM set outside, counting free workouts', () => {
    const sessions = exerciseSessions(
      'squat',
      history([
        // 120 × (1 + 3/30) = 132, the best e1RM outside "legs"
        { routineId: 'full', startedAt: '2026-01-01T10:00:00Z', sets: [{ weight: 120, reps: 3 }] },
        { routineId: 'legs', startedAt: '2026-01-05T10:00:00Z', sets: [{ weight: 150, reps: 3 }] },
        // free workout, the most recent outside: 100 × 8 (126.7) beats 105 × 3 (115.5)
        {
          routineId: null,
          startedAt: '2026-01-09T10:00:00Z',
          sets: [
            { weight: 60, reps: 10, type: 'warmup' },
            { weight: 105, reps: 3 },
            { weight: 100, reps: 8 },
          ],
        },
      ]),
    )
    const chip = otherRoutineChip(sessions, 'legs', 'weight_reps')
    expect(chip?.recent.startedAt).toBe('2026-01-09T10:00:00Z')
    expect(chip?.recent.routineId).toBeNull()
    expect(chip?.recent.bestSet).toMatchObject({ weight: 100, reps: 8 })
    expect(chip?.best.set).toMatchObject({ weight: 120, reps: 3 })
    expect(chip?.best.e1rm).toBeCloseTo(132)
    expect(chip?.best.startedAt).toBe('2026-01-01T10:00:00Z')
  })

  it('ranks reps exercises by reps and time exercises by duration', () => {
    const reps = exerciseSessions(
      'pullup',
      history([
        {
          exerciseId: 'pullup',
          startedAt: '2026-01-01T10:00:00Z',
          sets: [{ reps: 12 }, { reps: 8, weight: 10 }],
        },
      ]),
    )
    expect(otherRoutineChip(reps, 'back', 'reps')?.recent.bestSet.reps).toBe(12)
    expect(otherRoutineChip(reps, 'back', 'reps')?.best.e1rm).toBeNull()
    const time = exerciseSessions(
      'plank',
      history([
        {
          exerciseId: 'plank',
          startedAt: '2026-01-01T10:00:00Z',
          sets: [{ durationSec: 45 }, { durationSec: 60 }],
        },
      ]),
    )
    expect(otherRoutineChip(time, 'core', 'time')?.best.set.durationSec).toBe(60)
  })
})
