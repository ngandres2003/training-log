import { daysBetween, type DayKey } from './dates'

/**
 * Adherence: distinct trained days / target days of the period, as a rounded %.
 * The target is the weekly goal spread over the period's length (`from` and `to`
 * inclusive), so 4 weeks with a goal of 4 is 16 days.
 */
export function adherence(input: {
  trainedDays: DayKey[]
  from: DayKey
  to: DayKey
  weeklyGoal: number
}): number {
  const { from, to, weeklyGoal } = input
  const trained = new Set(input.trainedDays.filter((d) => d >= from && d <= to)).size
  const target = (weeklyGoal * (daysBetween(from, to) + 1)) / 7
  if (target <= 0) return 0
  return Math.round((trained / target) * 100)
}
