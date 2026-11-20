import type { WeightUnit } from './types'

/** Weights are stored in kg (KTD10); lb exists only at display and input. */
export const KG_PER_LB = 0.45359237

export const kgToLb = (kg: number) => kg / KG_PER_LB
export const lbToKg = (lb: number) => lb * KG_PER_LB

/** Display precision: one decimal in either unit. */
const round1 = (n: number) => Math.round(n * 10) / 10

/** A stored kg value as the number shown in the user's unit. */
export function displayWeight(kg: number, unit: WeightUnit): number {
  return round1(unit === 'lb' ? kgToLb(kg) : kg)
}

/** Shown number with a comma decimal, e.g. "82,5". */
export function formatWeightValue(kg: number, unit: WeightUnit): string {
  return String(displayWeight(kg, unit)).replace('.', ',')
}

/** e.g. "82,5 kg", "220,5 lb". */
export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${formatWeightValue(kg, unit)} ${unit}`
}

/** Parses user input in the user's unit, accepting "," or "." as decimal separator, into kg. */
export function parseWeightInput(text: string, unit: WeightUnit): number | null {
  const trimmed = text.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null
  const value = Number(trimmed)
  return unit === 'lb' ? lbToKg(value) : value
}
