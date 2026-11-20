import { describe, expect, it } from 'vitest'
import { MUSCLES } from '../../packages/domain/src/muscles'
import {
  DROPPED_TARGETS,
  PRIMARY_MUSCLE_MAP,
  SECONDARY_MUSCLE_MAP,
  mapPrimaryMuscle,
  mapSecondaryMuscles,
} from './muscle-map'

const FIXED = new Set(MUSCLES.map((m) => m.id))

describe('muscle map', () => {
  it('maps every dataset target onto the fixed muscle list', () => {
    for (const [source, id] of Object.entries(PRIMARY_MUSCLE_MAP)) {
      expect(FIXED.has(id), `${source} -> ${id}`).toBe(true)
    }
  })

  it('maps every dataset secondary muscle onto the fixed list or drops it explicitly', () => {
    for (const [source, id] of Object.entries(SECONDARY_MUSCLE_MAP)) {
      if (id !== null) expect(FIXED.has(id), `${source} -> ${id}`).toBe(true)
    }
  })

  it('translates known dataset names', () => {
    expect(mapPrimaryMuscle('pectorals')).toBe('chest')
    expect(mapPrimaryMuscle('upper back')).toBe('middle_back')
    expect(mapPrimaryMuscle('delts')).toBe('shoulders')
    expect(mapSecondaryMuscles(['rear deltoids', 'deltoids', 'feet', 'triceps'], 'shoulders')).toEqual([
      'triceps',
    ])
  })

  it('keeps the cardio target out of the primary map', () => {
    expect(DROPPED_TARGETS).toContain('cardiovascular system')
    expect(() => mapPrimaryMuscle('cardiovascular system')).toThrow(/unmapped/i)
  })

  it('throws on an unknown target or secondary muscle', () => {
    expect(() => mapPrimaryMuscle('pinky toe')).toThrow(/unmapped target muscle "pinky toe"/i)
    expect(() => mapSecondaryMuscles(['biceps', 'pinky toe'], 'chest')).toThrow(
      /unmapped secondary muscle "pinky toe"/i,
    )
  })
})
