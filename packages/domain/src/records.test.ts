import { describe, expect, it } from 'vitest'
import { exerciseSessions } from './history'
import { detectPr, personalRecords } from './records'
import { history, type SessionSpec } from './test-fixtures'
import type { SetType } from './types'

const s = (weight: number | null, reps: number | null, type: SetType = 'normal') => ({
  type,
  weight,
  reps,
  durationSec: null,
})
const t = (durationSec: number) => ({ type: 'normal' as SetType, weight: null, reps: null, durationSec })

const past = (exerciseId: string, ...sessions: SessionSpec['sets'][]) =>
  exerciseSessions(
    exerciseId,
    history(
      sessions.map((sets, i) => ({
        exerciseId,
        startedAt: `2026-01-0${i + 1}T10:00:00Z`,
        sets,
      })),
    ),
  )

describe('detectPr (R22, R23)', () => {
  it('Covers AE4. first-ever squat 100 × 5 shows no badge; next session 102.5 × 5 shows max weight', () => {
    expect(
      detectPr({ trackingType: 'weight_reps', history: [], earlier: [], candidate: s(100, 5) }),
    ).toBeNull()
    const sessions = past('squat', [{ weight: 100, reps: 5 }])
    expect(
      detectPr({ trackingType: 'weight_reps', history: sessions, earlier: [], candidate: s(102.5, 5) }),
    ).toBe('max_weight')
  })

  it('keeps the first session badge-free even after earlier sets of that same session', () => {
    expect(
      detectPr({
        trackingType: 'weight_reps',
        history: [],
        earlier: [s(100, 5)],
        candidate: s(110, 5),
      }),
    ).toBeNull()
  })

  it('gives exactly one badge, max weight, when a set beats both max weight and e1RM', () => {
    const sessions = past('squat', [{ weight: 100, reps: 5 }])
    expect(
      detectPr({ trackingType: 'weight_reps', history: sessions, earlier: [], candidate: s(105, 5) }),
    ).toBe('max_weight')
  })

  it('gives an e1RM badge when only the estimated 1RM improves', () => {
    const sessions = past('squat', [{ weight: 100, reps: 5 }]) // e1RM 116.67
    expect(
      detectPr({ trackingType: 'weight_reps', history: sessions, earlier: [], candidate: s(90, 10) }),
    ).toBe('e1rm')
  })

  it('gives a reps-at-weight badge for more reps at a weight already lifted', () => {
    const sessions = past('squat', [
      { weight: 100, reps: 5 },
      { weight: 80, reps: 8 },
    ])
    // 80 × 9: e1RM 104 < 116.67, but 9 > 8 reps at 80 kg
    expect(
      detectPr({ trackingType: 'weight_reps', history: sessions, earlier: [], candidate: s(80, 9) }),
    ).toBe('reps_at_weight')
    expect(
      detectPr({ trackingType: 'weight_reps', history: sessions, earlier: [], candidate: s(70, 9) }),
    ).toBeNull()
  })

  it('never gives a badge to a warm-up set, and warm-ups never set marks', () => {
    const sessions = past('squat', [
      { weight: 140, reps: 1, type: 'warmup' },
      { weight: 100, reps: 5 },
    ])
    expect(
      detectPr({
        trackingType: 'weight_reps',
        history: sessions,
        earlier: [],
        candidate: s(120, 5, 'warmup'),
      }),
    ).toBeNull()
    expect(
      detectPr({ trackingType: 'weight_reps', history: sessions, earlier: [], candidate: s(110, 1) }),
    ).toBe('max_weight')
  })

  it('does not count a 15-rep set toward e1RM', () => {
    // 90 × 15 would be 135 by Epley, but it is ignored; the e1RM mark stays 116.67
    const sessions = past('squat', [
      { weight: 100, reps: 5 },
      { weight: 90, reps: 15 },
    ])
    expect(
      detectPr({ trackingType: 'weight_reps', history: sessions, earlier: [], candidate: s(95, 8) }),
    ).toBe('e1rm')
    // 80 × 15 (Epley 120) is not an e1RM record either
    expect(
      detectPr({ trackingType: 'weight_reps', history: sessions, earlier: [], candidate: s(80, 15) }),
    ).toBeNull()
  })

  it('counts earlier sets of the current session as marks', () => {
    const sessions = past('squat', [{ weight: 100, reps: 5 }])
    expect(
      detectPr({
        trackingType: 'weight_reps',
        history: sessions,
        earlier: [s(102.5, 5)],
        candidate: s(102.5, 5),
      }),
    ).toBeNull()
  })

  it('reps exercise: more reps in a set, or a heavier added load', () => {
    const sessions = past('pullup', [{ reps: 10 }, { weight: 10, reps: 5 }])
    const base = { trackingType: 'reps' as const, history: sessions, earlier: [] }
    expect(detectPr({ ...base, candidate: s(null, 11) })).toBe('max_reps')
    expect(detectPr({ ...base, candidate: s(12.5, 6) })).toBe('max_added_load')
    expect(detectPr({ ...base, candidate: s(null, 10) })).toBeNull()
  })

  it('time exercise: longer duration', () => {
    const sessions = past('plank', [{ durationSec: 60 }])
    const base = { trackingType: 'time' as const, history: sessions, earlier: [] }
    expect(detectPr({ ...base, candidate: t(75) })).toBe('max_duration')
    expect(detectPr({ ...base, candidate: t(60) })).toBeNull()
  })
})

describe('personalRecords', () => {
  it('summarises the marks of a weight_reps exercise, including best session volume', () => {
    const sessions = past(
      'squat',
      [
        { weight: 100, reps: 5 },
        { weight: 100, reps: 5 },
      ],
      [{ weight: 110, reps: 2 }],
    )
    const marks = personalRecords(sessions, 'weight_reps')
    expect(marks?.maxWeight).toBe(110)
    expect(marks?.bestE1rm).toBeCloseTo(117.333, 2) // 110 × (1 + 2/30)
    expect(marks?.bestSessionVolume).toBe(1000)
    expect(marks?.repsAtWeight.get(100)).toBe(5)
  })

  it('is null before the exercise has any working set', () => {
    expect(personalRecords([], 'weight_reps')).toBeNull()
  })
})
