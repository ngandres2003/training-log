import { describe, expect, it } from 'vitest'
import { adherence } from './adherence'

const days = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => `2026-11-${String(from + i).padStart(2, '0')}`)

describe('adherence', () => {
  it('is 75 % for 12 trained days in 4 weeks with a goal of 4 days per week', () => {
    expect(
      adherence({ trainedDays: days(2, 12), from: '2026-11-02', to: '2026-11-29', weeklyGoal: 4 }),
    ).toBe(75)
  })

  it('counts each day once and ignores days outside the period', () => {
    expect(
      adherence({
        trainedDays: ['2026-11-01', '2026-11-02', '2026-11-02', '2026-11-03', '2026-11-09'],
        from: '2026-11-02',
        to: '2026-11-08',
        weeklyGoal: 4,
      }),
    ).toBe(50)
  })
})
