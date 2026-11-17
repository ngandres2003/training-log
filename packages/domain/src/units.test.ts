import { describe, expect, it } from 'vitest'
import { displayWeight, formatWeight, kgToLb, lbToKg, parseWeightInput } from './units'

describe('units (KTD10)', () => {
  it('converts kg and lb', () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 3)
    expect(lbToKg(220.462)).toBeCloseTo(100, 3)
  })

  it('round-trips 100 kg to lb and back to 100 kg at display precision', () => {
    const shownLb = displayWeight(100, 'lb')
    expect(shownLb).toBe(220.5)
    const storedKg = parseWeightInput(String(shownLb), 'lb')
    expect(displayWeight(storedKg!, 'kg')).toBe(100)
  })

  it('parses both comma and dot decimals into kg', () => {
    expect(parseWeightInput('82,5', 'kg')).toBe(82.5)
    expect(parseWeightInput(' 82.5 ', 'kg')).toBe(82.5)
    expect(parseWeightInput('', 'kg')).toBeNull()
    expect(parseWeightInput('abc', 'kg')).toBeNull()
  })

  it('formats with a comma decimal and the unit', () => {
    expect(formatWeight(82.5, 'kg')).toBe('82,5 kg')
    expect(formatWeight(100, 'kg')).toBe('100 kg')
    expect(formatWeight(100, 'lb')).toBe('220,5 lb')
  })
})
