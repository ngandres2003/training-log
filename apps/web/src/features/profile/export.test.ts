import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { saveSettings } from '../../data/repositories/settings'
import {
  addWorkoutExercise,
  addWorkoutSet,
  startWorkout,
  updateWorkout,
} from '../../data/repositories/workouts'
import { resetDb, TEST_USER } from '../../data/testUtils'
import { buildCsvExport, buildJsonExport } from './export'
import { seedAccount } from './test-fixtures'

beforeEach(resetDb)

describe('JSON export', () => {
  it('contains every live row of every table, settings included, tagged with the account', async () => {
    const seed = await seedAccount()
    const file = await buildJsonExport()
    expect(file.format).toBe('training-log-export')
    expect(file.formatVersion).toBe(1)
    expect(file.userId).toBe(TEST_USER.id)
    expect(file.tables.settings.map((r) => r.displayName)).toEqual(['Ana'])
    expect(file.tables.folders.map((r) => r.id)).toEqual([seed.folder.id])
    expect(file.tables.customExercises.map((r) => r.id)).toEqual([seed.custom.id])
    expect(file.tables.routines.map((r) => r.id)).toEqual([seed.routine.id])
    expect(file.tables.routineExercises.map((r) => r.id)).toEqual([seed.re.id])
    expect(file.tables.routineSets.map((r) => r.id)).toEqual([seed.rs.id])
    expect(file.tables.workouts.map((r) => r.id)).toEqual([seed.workout.id])
    expect(file.tables.workoutExercises).toHaveLength(2)
    expect(file.tables.workoutSets).toHaveLength(4)
  })
})

describe('CSV export', () => {
  const names = new Map([['plank', 'Plancha']])

  it('has one row per completed set of finished workouts, weight in the user unit', async () => {
    const seed = await seedAccount()
    await saveSettings({ unit: 'lb' })
    // A discarded workout's completed set is not history.
    const discarded = await startWorkout({
      routineId: null,
      name: 'Libre',
      startedAt: '2026-11-17T09:00:00.000Z',
    })
    const we = await addWorkoutExercise({
      workoutId: discarded.id,
      exerciseId: 'plank',
      routineExerciseId: null,
      order: 0,
      note: '',
      supersetGroup: null,
    })
    await addWorkoutSet({
      workoutExerciseId: we.id,
      order: 0,
      type: 'normal',
      weight: null,
      reps: null,
      durationSec: 30,
      rpe: null,
      completed: true,
      completedAt: '2026-11-17T09:05:00.000Z',
    })
    await updateWorkout(discarded.id, { status: 'discarded' })

    const csv = await buildCsvExport({
      exerciseName: (id) => (id === seed.custom.id ? seed.custom.name : names.get(id)),
      timeZone: 'Europe/Madrid',
    })
    expect(csv.replace(/^\uFEFF/, '').split('\r\n')).toEqual([
      'Fecha,Rutina,Ejercicio,Peso (lb),Reps,Duración (s),RPE',
      '2026-11-16,Empuje A,Press en máquina Hammer,132.3,8,,8',
      '2026-11-16,Empuje A,Press en máquina Hammer,137.8,6,,',
      '2026-11-16,Empuje A,Plancha,,,45,',
    ])
  })

  it('quotes fields containing commas or quotes', async () => {
    await seedAccount()
    const csv = await buildCsvExport({
      exerciseName: () => 'Press "inclinado", barra',
      timeZone: 'UTC',
    })
    expect(csv.split('\r\n')[1]).toBe('2026-11-16,Empuje A,"Press ""inclinado"", barra",60,8,,8')
  })
})
