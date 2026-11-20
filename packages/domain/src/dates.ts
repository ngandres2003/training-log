import type { WeekStart } from './types'

/** A local calendar day as `YYYY-MM-DD`. */
export type DayKey = string

/** Local calendar day of an ISO instant in an IANA time zone (e.g. the device's). */
export function localDayKey(iso: string, timeZone: string): DayKey {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

const toUtc = (day: DayKey) => Date.parse(`${day}T00:00:00Z`)
const fromUtc = (ms: number): DayKey => new Date(ms).toISOString().slice(0, 10)
const DAY_MS = 86_400_000

export function addDays(day: DayKey, days: number): DayKey {
  return fromUtc(toUtc(day) + days * DAY_MS)
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS)
}

/** First day of the week containing `day`. */
export function weekStartOf(day: DayKey, weekStart: WeekStart): DayKey {
  const weekday = new Date(toUtc(day)).getUTCDay() // 0 = Sunday
  const offset = weekStart === 'sunday' ? weekday : (weekday + 6) % 7
  return addDays(day, -offset)
}
