import { SYNC_TABLES, type SyncTable } from '@training-log/domain'
import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextVersions, selectForUser, syncTables } from './queries.js'
import { createTestDb, type TestDb } from './test-db.js'

let t: TestDb

beforeEach(async () => {
  t = await createTestDb()
})

afterEach(async () => {
  await t.close()
})

const now = new Date('2026-11-17T10:00:00Z')

/** Minimal valid row for each synced table, owned by `userId`. */
function rowFor(table: SyncTable, userId: string, id: string, version: number) {
  const base = { id, userId, version, updatedAt: now, deletedAt: null }
  const parent = '00000000-0000-7000-8000-000000000999'
  switch (table) {
    case 'settings':
      return { ...base, displayName: 'A', unit: 'kg', weeklyGoal: 3, weekStart: 'monday', theme: 'dark', preloadPrevious: true, soundOn: true, vibrationOn: true, keepScreenOn: false, onboardedAt: null }
    case 'folders':
      return { ...base, name: 'F', order: 0, isCycle: true }
    case 'routines':
      return { ...base, name: 'Pierna B', color: '#f00', folderId: null, notes: '', order: 0, archived: false, createdAt: now }
    case 'routineExercises':
      return { ...base, routineId: parent, exerciseId: 'barbell-squat', order: 0, restSec: null, note: '', supersetGroup: null }
    case 'routineSets':
      return { ...base, routineExerciseId: parent, order: 0, type: 'normal', targetRepsMin: 8, targetRepsMax: 12, targetWeight: 60, targetDurationSec: null }
    case 'workouts':
      return { ...base, routineId: parent, name: 'Pierna B', startedAt: now, endedAt: null, status: 'active', energy: 4, tags: ['gym'], note: '', restEndsAt: null }
    case 'workoutExercises':
      return { ...base, workoutId: parent, exerciseId: 'barbell-squat', routineExerciseId: null, order: 0, restSec: 90, note: '', supersetGroup: null }
    case 'workoutSets':
      return { ...base, workoutExerciseId: parent, order: 0, type: 'normal', weight: 62.5, reps: 8, durationSec: null, rpe: 8, completed: true, completedAt: now }
    case 'customExercises':
      return { ...base, name: 'Mi press', primaryMuscle: 'chest', secondaryMuscles: ['triceps', 'shoulders'], equipment: 'dumbbell', trackingType: 'weight_reps', imageUrl: null }
  }
}

describe('server schema', () => {
  it('applies migrations on an empty PGlite database and creates every synced table plus sync_counters', async () => {
    // The driver-neutral `Db` type leaves `execute` results untyped; PGlite returns `{ rows }`.
    const res = (await t.db.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    )) as unknown as { rows: { table_name: string }[] }
    const names = res.rows.map((r) => r.table_name)
    expect(names).toEqual(
      expect.arrayContaining([
        'settings',
        'folders',
        'routines',
        'routine_exercises',
        'routine_sets',
        'workouts',
        'workout_exercises',
        'workout_sets',
        'custom_exercises',
        'sync_counters',
      ]),
    )
    expect(names).not.toContain('personal_records')
  })

  it('moves rest to workout exercises: settings.default_rest_sec becomes nullable, workout_exercises.rest_sec is added', async () => {
    const res = (await t.db.execute(
      sql`select table_name, column_name, is_nullable from information_schema.columns
          where table_schema = 'public' and column_name in ('default_rest_sec', 'rest_sec') order by table_name`,
    )) as unknown as { rows: { table_name: string; column_name: string; is_nullable: string }[] }
    expect(res.rows).toEqual([
      { table_name: 'routine_exercises', column_name: 'rest_sec', is_nullable: 'YES' },
      { table_name: 'settings', column_name: 'default_rest_sec', is_nullable: 'YES' },
      { table_name: 'workout_exercises', column_name: 'rest_sec', is_nullable: 'YES' },
    ])
  })

  it('maps every shared sync table name to a Postgres table', () => {
    expect(Object.keys(syncTables).sort()).toEqual([...SYNC_TABLES].sort())
  })
})

describe('nextVersions', () => {
  it('gives the rows of one push strictly increasing versions, and the next push continues after them', async () => {
    const first = await t.db.transaction((tx) => nextVersions(tx, 'user-a', 2))
    expect(first).toEqual([1, 2])

    const second = await t.db.transaction((tx) => nextVersions(tx, 'user-a', 3))
    expect(second).toEqual([3, 4, 5])
  })

  it('keeps a separate counter per user', async () => {
    await t.db.transaction((tx) => nextVersions(tx, 'user-a', 4))
    const b = await t.db.transaction((tx) => nextVersions(tx, 'user-b', 2))
    expect(b).toEqual([1, 2])
  })
})

describe('selectForUser', () => {
  it.each(SYNC_TABLES)('never returns another user\'s rows from %s', async (table) => {
    const pg = syncTables[table]
    await t.db.insert(pg).values([
      rowFor(table, 'user-a', '00000000-0000-7000-8000-000000000001', 1),
      rowFor(table, 'user-b', '00000000-0000-7000-8000-000000000002', 1),
    ] as never)

    const rows = await selectForUser(t.db, table, 'user-a')
    expect(rows.map((r) => [r.id, r.userId])).toEqual([['00000000-0000-7000-8000-000000000001', 'user-a']])
  })

  it('round-trips array columns and nullable tombstones', async () => {
    await t.db.insert(syncTables.customExercises).values(
      rowFor('customExercises', 'user-a', '00000000-0000-7000-8000-000000000003', 7) as never,
    )
    const [row] = await selectForUser(t.db, 'customExercises', 'user-a')
    expect(row).toMatchObject({ secondaryMuscles: ['triceps', 'shoulders'], deletedAt: null, version: 7 })
  })
})
