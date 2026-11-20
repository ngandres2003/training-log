import { addDays, weekStartOf, type DayKey } from './dates'
import type { WeekStart } from './types'

export interface StreakInput {
  /** Local days with at least one finished workout (duplicates allowed). */
  trainedDays: DayKey[]
  today: DayKey
  weekStart: WeekStart
  weeklyGoal: number
}

/**
 * Weekly streak: consecutive weeks meeting the weekly goal. The current week
 * counts once it meets the goal, and while it is in progress it does not break
 * the streak.
 */
export function weeklyStreak({ trainedDays, today, weekStart, weeklyGoal }: StreakInput): {
  current: number
  best: number
} {
  const perWeek = new Map<DayKey, number>()
  for (const day of new Set(trainedDays)) {
    if (day > today) continue
    const week = weekStartOf(day, weekStart)
    perWeek.set(week, (perWeek.get(week) ?? 0) + 1)
  }
  const met = (week: DayKey) => (perWeek.get(week) ?? 0) >= weeklyGoal

  const thisWeek = weekStartOf(today, weekStart)
  let current = met(thisWeek) ? 1 : 0
  for (let week = addDays(thisWeek, -7); met(week); week = addDays(week, -7)) current++

  let best = 0
  for (const week of perWeek.keys()) {
    if (!met(week) || met(addDays(week, -7))) continue
    let run = 0
    for (let w = week; met(w); w = addDays(w, 7)) run++
    best = Math.max(best, run)
  }
  return { current, best }
}
