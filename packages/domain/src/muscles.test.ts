import { describe, expect, it } from 'vitest'
import { MUSCLES, isMuscleId, setsPerMuscle } from './muscles'

describe('muscles (R17)', () => {
  it('is a fixed list with unique ids, Spanish labels and a body region', () => {
    const ids = MUSCLES.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(
      expect.arrayContaining(['chest', 'lats', 'quadriceps', 'glutes', 'calves', 'lower_back']),
    )
    expect(MUSCLES.find((m) => m.id === 'chest')).toMatchObject({ label: 'Pecho', region: 'front' })
    expect(MUSCLES.find((m) => m.id === 'hamstrings')).toMatchObject({ region: 'back' })
    expect(isMuscleId('chest')).toBe(true)
    expect(isMuscleId('wings')).toBe(false)
  })

  it('counts a set as 1 for the primary muscle and 0.5 for each secondary muscle', () => {
    const result = setsPerMuscle([
      { primaryMuscle: 'chest', secondaryMuscles: ['triceps', 'shoulders'], sets: 4 },
      { primaryMuscle: 'triceps', secondaryMuscles: [], sets: 3 },
    ])
    expect(Object.fromEntries(result)).toEqual({ chest: 4, triceps: 5, shoulders: 2 })
  })
})
