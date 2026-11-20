import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from './db'

/** The schema as release 1 shipped it (historic snapshot, do not update). */
const V1_SCHEMA = {
  settings: 'id',
  folders: 'id',
  routines: 'id, folderId',
  routineExercises: 'id, routineId',
  routineSets: 'id, routineExerciseId',
  workouts: 'id, routineId, status, startedAt',
  workoutExercises: 'id, workoutId, exerciseId',
  workoutSets: 'id, workoutExerciseId',
  customExercises: 'id',
  outbox: 'key, table, updatedLocallyAt',
  syncMeta: 'key',
  syncErrors: 'key, table',
}

afterEach(async () => {
  db.close()
  await Dexie.delete('training-log')
})

describe('local database upgrade to per-exercise rest (v2)', () => {
  it('gives existing workout exercises no rest and drops the global default rest, in tables and outbox', async () => {
    db.close()
    await Dexie.delete('training-log')
    const old = new Dexie('training-log')
    old.version(1).stores(V1_SCHEMA)
    await old.open()
    const we = { id: 'we1', workoutId: 'w1', exerciseId: 'squat', routineExerciseId: null, order: 0, note: '', supersetGroup: null }
    const settings = { id: 's1', unit: 'kg', weeklyGoal: 3, defaultRestSec: 90 }
    await old.table('workoutExercises').put(we)
    await old.table('settings').put(settings)
    await old.table('outbox').bulkPut([
      { key: 'workoutExercises:we1', table: 'workoutExercises', rowId: 'we1', row: we, rev: 1, updatedLocallyAt: 'a' },
      { key: 'settings:s1', table: 'settings', rowId: 's1', row: settings, rev: 1, updatedLocallyAt: 'b' },
    ])
    old.close()

    await db.open()
    expect(await db.workoutExercises.get('we1')).toMatchObject({ id: 'we1', restSec: null })
    expect(await db.settings.get('s1')).not.toHaveProperty('defaultRestSec')
    const outbox = await db.outbox.toArray()
    expect(outbox.find((e) => e.table === 'workoutExercises')!.row).toMatchObject({ restSec: null })
    expect(outbox.find((e) => e.table === 'settings')!.row).not.toHaveProperty('defaultRestSec')
  })
})
