import {
  formatWeight,
  formatWeightValue,
  type DayKey,
  type TrackingType,
  type WeightUnit,
  type WorkoutSet,
} from '@training-log/domain'

/** "3 nov" for a local day key. */
export function dayLabel(day: DayKey): string {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${day}T00:00:00Z`))
    .replace('.', '')
}

/** "45 s", "1:30 min". */
export function formatDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} s`
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')} min`
}

/** Thousands with a dot and no decimals, e.g. "12.450". */
export const integer = (n: number) =>
  new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' }).format(n)

/** Volume in the user's unit without decimals, e.g. "12.450 kg". */
export function formatVolume(kg: number, unit: WeightUnit): string {
  return `${integer(Number(formatWeightValue(kg, unit).replace(',', '.')))} ${unit}`
}

/** A delta with its sign, e.g. "+3", "−120 kg", "±0". */
export function signed(n: number, format: (abs: number) => string = integer): string {
  if (n === 0) return `±${format(0)}`
  return `${n > 0 ? '+' : '−'}${format(Math.abs(n))}`
}

/** One set as text for its tracking type: "100 kg × 5", "12 reps · +10 kg", "1:30 min". */
export function setText(
  set: Pick<WorkoutSet, 'weight' | 'reps' | 'durationSec'>,
  trackingType: TrackingType,
  unit: WeightUnit,
): string {
  if (trackingType === 'time') return formatDuration(set.durationSec ?? 0)
  if (trackingType === 'reps') {
    const reps = `${set.reps ?? 0} reps`
    return set.weight ? `${reps} · +${formatWeight(set.weight, unit)}` : reps
  }
  return `${formatWeight(set.weight ?? 0, unit)} × ${set.reps ?? 0}`
}
