import { describe, expect, it } from 'vitest'
import { weeklyStreak } from './streak'

// 2026-11-17 is a Tuesday; 2026-11-01, -08 and -15 are Sundays.
const trained = ['2026-11-01', '2026-11-07', '2026-11-08', '2026-11-14', '2026-11-15', '2026-11-17']

describe('weeklyStreak', () => {
  it('counts consecutive weeks meeting the goal with a Sunday week start', () => {
    const r = weeklyStreak({ trainedDays: trained, today: '2026-11-17', weekStart: 'sunday', weeklyGoal: 2 })
    // Sun 1–Sat 7: 2, Sun 8–Sat 14: 2, Sun 15–: 2
    expect(r.current).toBe(3)
  })

  it('groups the same days differently with a Monday week start', () => {
    const r = weeklyStreak({ trainedDays: trained, today: '2026-11-17', weekStart: 'monday', weeklyGoal: 2 })
    // Mon 26 Oct–Sun 1: 1 ✗, Mon 2–Sun 8: 2 ✓, Mon 9–Sun 15: 2 ✓, Mon 16– (in progress): 1
    expect(r.current).toBe(2)
  })

  it('does not break the streak for the current week while it is still in progress', () => {
    const r = weeklyStreak({
      trainedDays: trained.filter((d) => d !== '2026-11-17'),
      today: '2026-11-17',
      weekStart: 'sunday',
      weeklyGoal: 2,
    })
    expect(r.current).toBe(2)
  })

  it('counts the same day once and reports the best streak', () => {
    const r = weeklyStreak({
      trainedDays: ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-19', '2026-11-02', '2026-11-16'],
      today: '2026-11-17',
      weekStart: 'monday',
      weeklyGoal: 1,
    })
    // Oct 5, 12, 19 weeks in a row = 3; Oct 26 week missed; Nov 2 = 1; Nov 9 missed; Nov 16 = 1
    expect(r).toEqual({ current: 1, best: 3 })
  })

  it('is zero with no training', () => {
    expect(
      weeklyStreak({ trainedDays: [], today: '2026-11-17', weekStart: 'monday', weeklyGoal: 3 }),
    ).toEqual({ current: 0, best: 0 })
  })
})
