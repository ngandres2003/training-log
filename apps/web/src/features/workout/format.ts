import { formatWeight, formatWeightValue, type Prefill, type TrackingType, type WeightUnit } from '@training-log/domain'

const pad = (n: number) => String(n).padStart(2, '0')

/** Workout chronometer, e.g. "00:42:18". */
export function elapsedClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

/** Rest countdown, e.g. "1:12" (rounded up so 0:00 means ended). */
export function restClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${pad(total % 60)}`
}

/** Set duration, e.g. "00:45", "01:30". */
export function durationText(sec: number): string {
  return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`
}

/** "45", "0:45" or "1:30" → seconds; null when empty or invalid. */
export function parseDuration(text: string): number | null {
  const t = text.trim()
  const m = /^(?:(\d+):)?(\d+)$/.exec(t)
  if (!m) return null
  return Number(m[1] ?? 0) * 60 + Number(m[2])
}

/** RPE 1–10 with "," or "." decimals (e.g. "9,5"); null when empty or out of range. */
export function parseRpe(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return n >= 1 && n <= 10 ? n : null
}

export const decimalText = (n: number) => String(n).replace('.', ',')

/** Compact set values for "Anterior" and the chip: "100 × 5", "+10 × 8", "8", "00:45". */
export function compactSet(v: Prefill, trackingType: TrackingType, unit: WeightUnit): string {
  if (trackingType === 'time') return v.durationSec != null ? durationText(v.durationSec) : '—'
  const reps = v.reps ?? 0
  if (trackingType === 'reps') return v.weight ? `+${formatWeightValue(v.weight, unit)} × ${reps}` : String(reps)
  return `${formatWeightValue(v.weight ?? 0, unit)} × ${reps}`
}

/** Set values with the unit: "102,5 kg × 5", "+10 kg × 8", "12 reps", "00:45". */
export function fullSet(v: Prefill, trackingType: TrackingType, unit: WeightUnit): string {
  if (trackingType === 'time') return v.durationSec != null ? durationText(v.durationSec) : '—'
  const reps = v.reps ?? 0
  if (trackingType === 'reps') return v.weight ? `+${formatWeight(v.weight, unit)} × ${reps}` : `${reps} reps`
  return `${formatWeight(v.weight ?? 0, unit)} × ${reps}`
}
