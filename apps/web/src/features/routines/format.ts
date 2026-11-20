import {
  daysBetween,
  formatWeight,
  localDayKey,
  type DayKey,
  type RoutineSet,
  type TrackingType,
  type WeightUnit,
  type Workout,
} from '@training-log/domain'

export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

export const dayOf = (iso: string): DayKey => localDayKey(iso, deviceTimeZone())

export const todayKey = (): DayKey => dayOf(new Date().toISOString())

/** "hoy", "ayer", "hace 3 días". */
export function relativeDay(iso: string, today: DayKey = todayKey()): string {
  const days = daysBetween(dayOf(iso), today)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}

/** Whole minutes of a finished workout, or null when it has no end. */
export function workoutMinutes(w: Pick<Workout, 'startedAt' | 'endedAt'>): number | null {
  if (!w.endedAt) return null
  return Math.round((Date.parse(w.endedAt) - Date.parse(w.startedAt)) / 60_000)
}

/** One decimal with a comma, e.g. "8,5". */
export const decimal1 = (n: number) => n.toFixed(1).replace('.', ',')

/** "14 nov" */
export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: deviceTimeZone() })
    .format(new Date(iso))
    .replace('.', '')
}

function repsRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null
  if (min == null || max == null || min === max) return String(min ?? max)
  return `${min}–${max}`
}

/** V2 target line, e.g. "3 × 8–12 · 60 kg", "3 × 10 · +10 kg", "3 × 45 s". */
export function targetSummary(sets: RoutineSet[], trackingType: TrackingType, unit: WeightUnit): string {
  const n = sets.length
  if (n === 0) return 'Sin series'
  const ref = sets.find((s) => s.type !== 'warmup') ?? sets[0]!
  if (trackingType === 'time') {
    return ref.targetDurationSec != null ? `${n} × ${ref.targetDurationSec} s` : `${n} series`
  }
  const reps = repsRange(ref.targetRepsMin, ref.targetRepsMax)
  let text = reps ? `${n} × ${reps}` : `${n} series`
  if (ref.targetWeight != null) {
    const w = formatWeight(ref.targetWeight, unit)
    text += trackingType === 'reps' ? ` · +${w}` : ` · ${w}`
  }
  return text
}
