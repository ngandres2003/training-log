/**
 * Server schema for the synced entities (U2). Mirrors `SyncRowByTable` in
 * `@training-log/domain`, with snake_case columns.
 *
 * - Ids are client-supplied UUIDv7 (KTD6).
 * - `version` comes from the owner's `sync_counters` row (KTD5); `updated_at` is set by the server.
 * - Deletes are tombstones (`deleted_at`).
 * - Rows reference parents by id only: no foreign keys, so a push batch can arrive in any order
 *   and one user's rows can never block or cascade into another's.
 * - Derived data (PRs, volume, ...) is never stored (KTD7).
 * - Better Auth tables are generated separately (U3).
 */
import type {
  Equipment,
  SetType,
  Theme,
  TrackingType,
  WeekStart,
  WeightUnit,
  WorkoutStatus,
} from '@training-log/domain'
import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

/** Columns every synced row carries (`SyncFields`). */
const syncColumns = () => ({
  id: uuid('id').primaryKey(),
  userId: text('user_id').notNull(),
  updatedAt: tstz('updated_at').notNull().defaultNow(),
  deletedAt: tstz('deleted_at'),
  version: bigint('version', { mode: 'number' }).notNull(),
})

/** One row per user; push increments it inside its transaction, which also locks it (KTD5). */
export const syncCounters = pgTable('sync_counters', {
  userId: text('user_id').primaryKey(),
  value: bigint('value', { mode: 'number' }).notNull().default(0),
})

export const settings = pgTable(
  'settings',
  {
    ...syncColumns(),
    displayName: text('display_name').notNull(),
    unit: text('unit').$type<WeightUnit>().notNull(),
    weeklyGoal: integer('weekly_goal').notNull(),
    /**
     * Deprecated: the global default rest was replaced by per-exercise rest on workout exercises
     * (contract v2). Nullable and no longer written or synced, so a server still running the
     * previous release keeps working after this migration; drop it in a later migration.
     */
    legacyDefaultRestSec: integer('default_rest_sec'),
    weekStart: text('week_start').$type<WeekStart>().notNull(),
    theme: text('theme').$type<Theme>().notNull(),
    preloadPrevious: boolean('preload_previous').notNull(),
    soundOn: boolean('sound_on').notNull(),
    vibrationOn: boolean('vibration_on').notNull(),
    keepScreenOn: boolean('keep_screen_on').notNull(),
    onboardedAt: tstz('onboarded_at'),
  },
  (t) => [
    index('settings_user_version_idx').on(t.userId, t.version),
    uniqueIndex('settings_user_unique').on(t.userId),
  ],
)

export const folders = pgTable(
  'folders',
  {
    ...syncColumns(),
    name: text('name').notNull(),
    order: integer('order').notNull(),
    isCycle: boolean('is_cycle').notNull(),
  },
  (t) => [index('folders_user_version_idx').on(t.userId, t.version)],
)

export const routines = pgTable(
  'routines',
  {
    ...syncColumns(),
    name: text('name').notNull(),
    color: text('color').notNull(),
    folderId: uuid('folder_id'),
    notes: text('notes').notNull(),
    order: integer('order').notNull(),
    archived: boolean('archived').notNull(),
    createdAt: tstz('created_at').notNull(),
  },
  (t) => [index('routines_user_version_idx').on(t.userId, t.version)],
)

export const routineExercises = pgTable(
  'routine_exercises',
  {
    ...syncColumns(),
    routineId: uuid('routine_id').notNull(),
    /** Catalog slug or custom exercise id, so plain text. */
    exerciseId: text('exercise_id').notNull(),
    order: integer('order').notNull(),
    restSec: integer('rest_sec'),
    note: text('note').notNull(),
    supersetGroup: text('superset_group'),
  },
  (t) => [index('routine_exercises_user_version_idx').on(t.userId, t.version)],
)

export const routineSets = pgTable(
  'routine_sets',
  {
    ...syncColumns(),
    routineExerciseId: uuid('routine_exercise_id').notNull(),
    order: integer('order').notNull(),
    type: text('type').$type<SetType>().notNull(),
    targetRepsMin: integer('target_reps_min'),
    targetRepsMax: integer('target_reps_max'),
    targetWeight: doublePrecision('target_weight'),
    targetDurationSec: integer('target_duration_sec'),
  },
  (t) => [index('routine_sets_user_version_idx').on(t.userId, t.version)],
)

export const workouts = pgTable(
  'workouts',
  {
    ...syncColumns(),
    routineId: uuid('routine_id'),
    /** Routine name copied at start, kept after the routine is deleted (R12). */
    name: text('name').notNull(),
    startedAt: tstz('started_at').notNull(),
    endedAt: tstz('ended_at'),
    status: text('status').$type<WorkoutStatus>().notNull(),
    energy: integer('energy'),
    tags: text('tags').array().notNull(),
    note: text('note').notNull(),
    restEndsAt: tstz('rest_ends_at'),
  },
  (t) => [index('workouts_user_version_idx').on(t.userId, t.version)],
)

export const workoutExercises = pgTable(
  'workout_exercises',
  {
    ...syncColumns(),
    workoutId: uuid('workout_id').notNull(),
    exerciseId: text('exercise_id').notNull(),
    routineExerciseId: uuid('routine_exercise_id'),
    order: integer('order').notNull(),
    /** Rest after each set; null = no rest timer. */
    restSec: integer('rest_sec'),
    note: text('note').notNull(),
    supersetGroup: text('superset_group'),
  },
  (t) => [index('workout_exercises_user_version_idx').on(t.userId, t.version)],
)

export const workoutSets = pgTable(
  'workout_sets',
  {
    ...syncColumns(),
    workoutExerciseId: uuid('workout_exercise_id').notNull(),
    order: integer('order').notNull(),
    type: text('type').$type<SetType>().notNull(),
    /** kg for weight_reps; added load in kg for reps. */
    weight: doublePrecision('weight'),
    reps: integer('reps'),
    durationSec: integer('duration_sec'),
    rpe: doublePrecision('rpe'),
    completed: boolean('completed').notNull(),
    completedAt: tstz('completed_at'),
  },
  (t) => [index('workout_sets_user_version_idx').on(t.userId, t.version)],
)

export const customExercises = pgTable(
  'custom_exercises',
  {
    ...syncColumns(),
    name: text('name').notNull(),
    primaryMuscle: text('primary_muscle').notNull(),
    secondaryMuscles: text('secondary_muscles').array().notNull(),
    equipment: text('equipment').$type<Equipment>().notNull(),
    trackingType: text('tracking_type').$type<TrackingType>().notNull(),
    imageUrl: text('image_url'),
  },
  (t) => [
    index('custom_exercises_user_version_idx').on(t.userId, t.version),
    check('custom_exercises_tracking_type_check', sql`${t.trackingType} in ('weight_reps', 'reps', 'time')`),
  ],
)

export * from './auth-schema.js'
export * from './invites-schema.js'
