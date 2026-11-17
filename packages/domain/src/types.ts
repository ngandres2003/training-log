/**
 * Shared entity shapes for the app, the local database and the sync API.
 * Units are canonical (KTD10): weights in kg, durations in seconds.
 * Timestamps are ISO-8601 strings in UTC.
 */

export type Id = string // UUIDv7, generated on the client (KTD6)

/** Fields every synced row carries. `updatedAt` and `version` are set by the server. */
export interface SyncFields {
  id: Id
  userId: Id
  updatedAt: string
  deletedAt: string | null
  /** Server-assigned per-user version; 0 until the row has been pushed once. */
  version: number
}

export type WeightUnit = 'kg' | 'lb'
export type WeekStart = 'monday' | 'sunday'
export type Theme = 'dark' | 'light' | 'system'

export interface Settings extends SyncFields {
  displayName: string
  unit: WeightUnit
  weeklyGoal: number // 1–7 days
  defaultRestSec: number
  weekStart: WeekStart
  theme: Theme
  preloadPrevious: boolean
  soundOn: boolean
  vibrationOn: boolean
  keepScreenOn: boolean
  onboardedAt: string | null
}

export type TrackingType = 'weight_reps' | 'reps' | 'time'

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight'

/** Ids from the fixed muscle list in `muscles.ts`. */
export type MuscleId = string

export interface ExerciseBase {
  id: Id
  name: string
  primaryMuscle: MuscleId
  secondaryMuscles: MuscleId[]
  equipment: Equipment
  trackingType: TrackingType
  imageUrl: string | null
}

/** Catalog exercise: static, shared by every user, never synced. */
export type CatalogExercise = ExerciseBase

/** Custom exercise: private to its owner and synced. */
export interface CustomExercise extends ExerciseBase, SyncFields {}

export type Exercise = CatalogExercise | CustomExercise

export interface Folder extends SyncFields {
  name: string
  order: number
  /** A cycle folder ("programa en ciclo") orders its routines A → B → C (R9). */
  isCycle: boolean
}

export interface Routine extends SyncFields {
  name: string
  color: string
  folderId: Id | null
  notes: string
  order: number
  archived: boolean
  createdAt: string
}

export interface RoutineExercise extends SyncFields {
  routineId: Id
  exerciseId: Id
  order: number
  restSec: number | null
  note: string
  /** Exercises sharing a group id form a superset, in `order`. */
  supersetGroup: string | null
}

export type SetType = 'warmup' | 'normal' | 'drop' | 'failure'

export interface RoutineSet extends SyncFields {
  routineExerciseId: Id
  order: number
  type: SetType
  targetRepsMin: number | null
  targetRepsMax: number | null
  /** kg for weight_reps; added load in kg for reps. */
  targetWeight: number | null
  targetDurationSec: number | null
}

export type WorkoutStatus = 'active' | 'finished' | 'discarded'

export interface Workout extends SyncFields {
  routineId: Id | null // null for a free workout
  /** Copy of the routine name at start, kept when the routine is deleted (R12). */
  name: string
  startedAt: string
  endedAt: string | null
  status: WorkoutStatus
  energy: number | null // 1–5
  tags: string[]
  note: string
  /** Rest timer end for the active workout (KTD9). */
  restEndsAt: string | null
}

export interface WorkoutExercise extends SyncFields {
  workoutId: Id
  exerciseId: Id
  routineExerciseId: Id | null
  order: number
  note: string
  supersetGroup: string | null
}

export interface WorkoutSet extends SyncFields {
  workoutExerciseId: Id
  order: number
  type: SetType
  /** kg for weight_reps; added load in kg for reps (null = bodyweight only). */
  weight: number | null
  reps: number | null
  durationSec: number | null
  rpe: number | null // 1–10, optional (R21)
  completed: boolean
  completedAt: string | null
}

/** Names of the synced tables, shared by the local database and the sync API. */
export const SYNC_TABLES = [
  'settings',
  'folders',
  'routines',
  'routineExercises',
  'routineSets',
  'workouts',
  'workoutExercises',
  'workoutSets',
  'customExercises',
] as const

export type SyncTable = (typeof SYNC_TABLES)[number]

export interface SyncRowByTable {
  settings: Settings
  folders: Folder
  routines: Routine
  routineExercises: RoutineExercise
  routineSets: RoutineSet
  workouts: Workout
  workoutExercises: WorkoutExercise
  workoutSets: WorkoutSet
  customExercises: CustomExercise
}
