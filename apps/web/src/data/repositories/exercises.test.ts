import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb } from '../testUtils'
import { createCustomExercise, deleteCustomExercise, listCustomExercises } from './exercises'

beforeEach(resetDb)

const base = {
  primaryMuscle: 'chest',
  secondaryMuscles: [],
  equipment: 'dumbbell' as const,
  trackingType: 'weight_reps' as const,
  imageUrl: null,
}

describe('custom exercises repository', () => {
  it('lists live custom exercises by name and hides deleted ones', async () => {
    const press = await createCustomExercise({ ...base, name: 'Press inclinado' })
    const apertura = await createCustomExercise({ ...base, name: 'Apertura' })
    const curl = await createCustomExercise({ ...base, name: 'Curl' })

    await deleteCustomExercise(curl.id)

    expect((await listCustomExercises()).map((x) => x.id)).toEqual([apertura.id, press.id])
  })
})
