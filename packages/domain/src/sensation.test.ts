import { describe, expect, it } from 'vitest'
import { averageSensation } from './sensation'
import { workout, workoutSet } from './test-fixtures'

describe('averageSensation (R28)', () => {
  it('returns energy average and RPE average separately', () => {
    const result = averageSensation({
      workouts: [workout({ energy: 4 }), workout({ energy: 3 }), workout({ energy: null })],
      sets: [
        workoutSet({ rpe: 8 }),
        workoutSet({ rpe: 9 }),
        workoutSet({ rpe: null }),
        workoutSet({ rpe: 5, type: 'warmup' }),
        workoutSet({ rpe: 10, completed: false }),
      ],
    })
    expect(result).toEqual({ energy: 3.5, rpe: 8.5 })
  })

  it('gives a null RPE when no set has RPE, and a null energy with no energy logged', () => {
    expect(
      averageSensation({ workouts: [workout({ energy: null })], sets: [workoutSet({ rpe: null })] }),
    ).toEqual({ energy: null, rpe: null })
  })
})
