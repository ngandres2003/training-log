import { describe, expect, it } from 'vitest'
import {
  CONTRACT_VERSION,
  MIN_SUPPORTED_CONTRACT_VERSION,
  SYNC_TABLE_NAMES,
  checkChange,
  rowGuards,
  rowProblem,
} from './sync'

const ID = '0190f5a2-7b1c-7d3e-8f00-123456789abc'
const OTHER_ID = '0190f5a2-7b1c-7d3e-8f00-cba987654321'
const NOW = '2026-11-19T10:00:00.000Z'

const sync = { id: ID, userId: 'u1', updatedAt: NOW, deletedAt: null, version: 0 }

const validRows = {
  settings: {
    ...sync,
    displayName: 'Ana',
    unit: 'kg',
    weeklyGoal: 4,
    defaultRestSec: 90,
    weekStart: 'monday',
    theme: 'dark',
    preloadPrevious: true,
    soundOn: true,
    vibrationOn: false,
    keepScreenOn: true,
    onboardedAt: null,
  },
  folders: { ...sync, name: 'PPL', order: 0, isCycle: true },
  routines: {
    ...sync,
    name: 'Push',
    color: '#ff0000',
    folderId: OTHER_ID,
    notes: '',
    order: 1,
    archived: false,
    createdAt: NOW,
  },
  routineExercises: {
    ...sync,
    routineId: OTHER_ID,
    exerciseId: 'barbell-bench-press',
    order: 0,
    restSec: null,
    note: '',
    supersetGroup: 'A',
  },
  routineSets: {
    ...sync,
    routineExerciseId: OTHER_ID,
    order: 0,
    type: 'normal',
    targetRepsMin: 8,
    targetRepsMax: 12,
    targetWeight: 62.5,
    targetDurationSec: null,
  },
  workouts: {
    ...sync,
    routineId: null,
    name: 'Libre',
    startedAt: NOW,
    endedAt: '2026-11-19T11:00:00+01:00',
    status: 'finished',
    energy: 4,
    tags: ['bien'],
    note: '',
    restEndsAt: null,
  },
  workoutExercises: {
    ...sync,
    workoutId: OTHER_ID,
    exerciseId: OTHER_ID,
    routineExerciseId: null,
    order: 2,
    note: 'n',
    supersetGroup: null,
  },
  workoutSets: {
    ...sync,
    workoutExerciseId: OTHER_ID,
    order: 0,
    type: 'warmup',
    weight: 20,
    reps: 10,
    durationSec: null,
    rpe: 7.5,
    completed: true,
    completedAt: NOW,
  },
  customExercises: {
    ...sync,
    name: 'Mi press',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps'],
    equipment: 'other',
    trackingType: 'time',
    imageUrl: null,
  },
} as const

describe('contract versions', () => {
  it('starts at version 1 and supports it', () => {
    expect(CONTRACT_VERSION).toBe(1)
    expect(MIN_SUPPORTED_CONTRACT_VERSION).toBe(1)
  })
})

describe('row guards', () => {
  it('covers the nine synced tables', () => {
    expect([...SYNC_TABLE_NAMES].sort()).toEqual(
      [
        'customExercises',
        'folders',
        'routineExercises',
        'routineSets',
        'routines',
        'settings',
        'workoutExercises',
        'workoutSets',
        'workouts',
      ].sort(),
    )
  })

  for (const table of SYNC_TABLE_NAMES) {
    it(`accepts a valid ${table} row`, () => {
      expect(rowProblem(table, validRows[table])).toBeNull()
      expect(rowGuards[table](validRows[table])).toBe(true)
    })

    it(`rejects a ${table} row without an id`, () => {
      const { id: _id, ...row } = validRows[table]
      expect(rowProblem(table, row)).toBe('id')
      expect(rowGuards[table](row)).toBe(false)
    })
  }

  it('does not require the server-owned fields userId, updatedAt and version', () => {
    const { userId: _u, updatedAt: _t, version: _v, ...row } = validRows.folders
    expect(rowProblem('folders', row)).toBeNull()
  })

  it('accepts a tombstone with an ISO deletedAt', () => {
    expect(rowProblem('folders', { ...validRows.folders, deletedAt: NOW })).toBeNull()
  })

  it.each([
    ['folders', { id: 'not-a-uuid' }, 'id'],
    ['folders', { name: 3 }, 'name'],
    ['folders', { name: 'a\u0000b' }, 'name'],
    ['folders', { order: 1.5 }, 'order'],
    ['folders', { order: 2 ** 31 }, 'order'],
    ['folders', { isCycle: 'yes' }, 'isCycle'],
    ['folders', { deletedAt: 'yesterday' }, 'deletedAt'],
    ['settings', { unit: 'stone' }, 'unit'],
    ['settings', { onboardedAt: undefined }, 'onboardedAt'],
    ['routines', { folderId: 'abc' }, 'folderId'],
    ['routines', { createdAt: null }, 'createdAt'],
    ['workouts', { tags: ['ok', 1] }, 'tags'],
    ['workouts', { status: 'paused' }, 'status'],
    ['workoutSets', { rpe: '7' }, 'rpe'],
    ['customExercises', { trackingType: 'distance' }, 'trackingType'],
  ] as const)('rejects %s with %o at field %s', (table, patch, field) => {
    const row = { ...validRows[table], ...patch }
    expect(rowProblem(table, row)).toBe(field)
    expect(rowGuards[table](row)).toBe(false)
  })

  it('rejects values that are not objects', () => {
    expect(rowProblem('folders', null)).toBe('row')
    expect(rowProblem('folders', [validRows.folders])).toBe('row')
  })
})

describe('checkChange', () => {
  it('accepts a well-formed change', () => {
    const change = { table: 'folders', rev: 3, row: validRows.folders }
    expect(checkChange(change)).toEqual({ ok: true, change })
  })

  it.each([
    [null, 'change'],
    [{ table: 'personalRecords', rev: 1, row: validRows.folders }, 'table'],
    [{ table: 'folders', rev: -1, row: validRows.folders }, 'rev'],
    [{ table: 'folders', rev: '1', row: validRows.folders }, 'rev'],
    [{ table: 'folders', rev: 1, row: { ...validRows.folders, isCycle: 1 } }, 'row.isCycle'],
  ])('rejects %o with reason invalid:%s', (change, field) => {
    expect(checkChange(change)).toEqual({ ok: false, reason: `invalid:${field}` })
  })
})
