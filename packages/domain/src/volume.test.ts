import { describe, expect, it } from 'vitest'
import type { SetType } from './types'
import { e1rm, setVolume, totalVolume } from './volume'

const set = (p: { weight?: number | null; reps?: number | null; type?: SetType; completed?: boolean }) => ({
  type: 'normal' as SetType,
  weight: null,
  reps: null,
  completed: true,
  ...p,
})

describe('e1rm', () => {
  it('uses Epley: 100 kg × 5 reps is 116.67', () => {
    expect(e1rm(100, 5)).toBeCloseTo(116.667, 2)
  })

  it('counts 12 reps but not 15 reps', () => {
    expect(e1rm(60, 12)).toBeCloseTo(84)
    expect(e1rm(60, 15)).toBeNull()
  })

  it('has no value without weight or reps', () => {
    expect(e1rm(null, 5)).toBeNull()
    expect(e1rm(100, 0)).toBeNull()
  })
})

describe('volume (R23)', () => {
  it('is weight × reps for weight_reps', () => {
    expect(setVolume(set({ weight: 80, reps: 8 }), 'weight_reps')).toBe(640)
  })

  it('is added load × reps for bodyweight, and 0 with no added load', () => {
    expect(setVolume(set({ weight: 10, reps: 8 }), 'reps')).toBe(80)
    expect(setVolume(set({ weight: null, reps: 12 }), 'reps')).toBe(0)
  })

  it('is 0 for time exercises', () => {
    expect(setVolume(set({ weight: 20 }), 'time')).toBe(0)
  })

  it('totals completed working sets only, excluding warm-ups', () => {
    const sets = [
      set({ weight: 40, reps: 10, type: 'warmup' }),
      set({ weight: 80, reps: 8 }),
      set({ weight: 80, reps: 6, type: 'drop' }),
      set({ weight: 80, reps: 8, completed: false }),
    ]
    expect(totalVolume(sets, 'weight_reps')).toBe(1120)
  })
})
