import { describe, expect, it } from 'vitest'
import { exerciseSessions } from './history'
import { lastRoutineSession, pairPrevious } from './previous'
import { history } from './test-fixtures'

const row = (weight: number, reps: number, type: 'warmup' | 'normal' = 'normal') => ({
  type,
  weight,
  reps,
  durationSec: null,
})

describe('pairPrevious (R18)', () => {
  it('Covers AE1. 4 rows last time and 6 today: rows 5-6 show — and prefill from row 4', () => {
    const last = [row(60, 10), row(80, 8), row(80, 8), row(85, 6)]
    const rows = pairPrevious(last, 6)
    expect(rows.map((r) => r.previous?.weight ?? '—')).toEqual([60, 80, 80, 85, '—', '—'])
    expect(rows.map((r) => r.prefill?.weight)).toEqual([60, 80, 80, 85, 85, 85])
    expect(rows[5]!.prefill).toEqual({ weight: 85, reps: 6, durationSec: null })
  })

  it('Covers AE2. an extra warm-up at row 2 today pairs with last session row 2 even if it was a working set', () => {
    const last = [row(40, 10, 'warmup'), row(80, 8), row(80, 8)]
    const rows = pairPrevious(last, 4)
    expect(rows[1]!.previous).toEqual(row(80, 8))
    expect(rows[1]!.prefill).toEqual({ weight: 80, reps: 8, durationSec: null })
  })

  it('returns no previous and no prefills when the routine has never been done', () => {
    expect(pairPrevious([], 3)).toEqual([
      { previous: null, prefill: null },
      { previous: null, prefill: null },
      { previous: null, prefill: null },
    ])
  })
})

describe('lastRoutineSession', () => {
  it('picks the most recent session of this routine, ignoring other routines and free workouts', () => {
    const sessions = exerciseSessions(
      'squat',
      history([
        { routineId: 'legs', startedAt: '2026-01-01T10:00:00Z', sets: [{ weight: 90, reps: 5 }] },
        { routineId: 'legs', startedAt: '2026-01-08T10:00:00Z', sets: [{ weight: 95, reps: 5 }] },
        { routineId: 'full', startedAt: '2026-01-10T10:00:00Z', sets: [{ weight: 99, reps: 5 }] },
        { routineId: null, startedAt: '2026-01-11T10:00:00Z', sets: [{ weight: 98, reps: 5 }] },
      ]),
    )
    expect(lastRoutineSession(sessions, 'legs')?.sets[0]?.weight).toBe(95)
    expect(lastRoutineSession(sessions, 'push')).toBeNull()
  })
})
