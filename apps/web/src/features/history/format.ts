import type { DayKey } from '@training-log/domain'

// Day keys are calendar days, so they are formatted in UTC to avoid any time-zone shift.
const at = (day: DayKey) => new Date(`${day}T00:00:00Z`)

const longDay = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})
const longDayYear = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const shortDay = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})
const shortWeekday = new Intl.DateTimeFormat('es-ES', { weekday: 'short', timeZone: 'UTC' })
const monthYear = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const shortMonth = new Intl.DateTimeFormat('es-ES', { month: 'short', timeZone: 'UTC' })

const strip = (s: string) => s.replace('.', '')

/** "martes, 10 de noviembre" */
export const formatLongDay = (day: DayKey) => longDay.format(at(day))
/** "martes, 10 de noviembre de 2026" */
export const formatLongDayYear = (day: DayKey) => longDayYear.format(at(day))
/** "16 nov" */
export const formatShortDay = (day: DayKey) => strip(shortDay.format(at(day)))
/** "mar 17 nov" */
export const formatRowDay = (day: DayKey) =>
  `${strip(shortWeekday.format(at(day)))} ${formatShortDay(day)}`
/** "noviembre de 2026" for a `YYYY-MM` month key. */
export const formatMonth = (month: string) => monthYear.format(at(`${month}-01`))
/** "nov" */
export const formatShortMonth = (day: DayKey) => strip(shortMonth.format(at(day)))

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
