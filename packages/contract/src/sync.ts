/**
 * Wire contract for `/api/sync` (U6, KTD5). Row shapes are declared once as field specs; the
 * TypeScript types and the runtime validators are both derived from them. The API checks at
 * compile time that these types match `SyncRowByTable` in `@training-log/domain`.
 *
 * Timestamps travel as ISO-8601 strings.
 */

/**
 * Bump when the wire format changes; the server refuses pushes below `MIN_SUPPORTED_CONTRACT_VERSION`.
 * v2: `workoutExercises.restSec` (per-exercise rest) is required and `settings.defaultRestSec` is gone,
 * so v1 clients are told to update instead of having their workout exercises rejected.
 */
export const CONTRACT_VERSION = 2
export const MIN_SUPPORTED_CONTRACT_VERSION = 2

/** Most changes one push may carry; with full rows this stays well under the 4 MB body limit. */
export const MAX_PUSH_CHANGES = 500
/** Most rows one pull page returns (also the default page size). */
export const MAX_PULL_LIMIT = 500

// ---------------------------------------------------------------------------
// Field specs

type Kind = 'string' | 'int' | 'number' | 'boolean' | 'timestamp' | 'uuid' | 'stringArray'
type Enum = readonly string[]
type Base = Kind | Enum
export type FieldSpec = Base | { readonly nullable: Base }

const nullable = <const B extends Base>(b: B) => ({ nullable: b }) as const

const SET_TYPES = ['warmup', 'normal', 'drop', 'failure'] as const

/** Table-specific columns of each synced row (sync fields are added below). */
export const ROW_SPECS = {
  settings: {
    displayName: 'string',
    unit: ['kg', 'lb'],
    weeklyGoal: 'int',
    weekStart: ['monday', 'sunday'],
    theme: ['dark', 'light', 'system'],
    preloadPrevious: 'boolean',
    soundOn: 'boolean',
    vibrationOn: 'boolean',
    keepScreenOn: 'boolean',
    onboardedAt: nullable('timestamp'),
  },
  folders: { name: 'string', order: 'int', isCycle: 'boolean' },
  routines: {
    name: 'string',
    color: 'string',
    folderId: nullable('uuid'),
    notes: 'string',
    order: 'int',
    archived: 'boolean',
    createdAt: 'timestamp',
  },
  routineExercises: {
    routineId: 'uuid',
    exerciseId: 'string',
    order: 'int',
    restSec: nullable('int'),
    note: 'string',
    supersetGroup: nullable('string'),
  },
  routineSets: {
    routineExerciseId: 'uuid',
    order: 'int',
    type: SET_TYPES,
    targetRepsMin: nullable('int'),
    targetRepsMax: nullable('int'),
    targetWeight: nullable('number'),
    targetDurationSec: nullable('int'),
  },
  workouts: {
    routineId: nullable('uuid'),
    name: 'string',
    startedAt: 'timestamp',
    endedAt: nullable('timestamp'),
    status: ['active', 'finished', 'discarded'],
    energy: nullable('int'),
    tags: 'stringArray',
    note: 'string',
    restEndsAt: nullable('timestamp'),
  },
  workoutExercises: {
    workoutId: 'uuid',
    exerciseId: 'string',
    routineExerciseId: nullable('uuid'),
    order: 'int',
    restSec: nullable('int'),
    note: 'string',
    supersetGroup: nullable('string'),
  },
  workoutSets: {
    workoutExerciseId: 'uuid',
    order: 'int',
    type: SET_TYPES,
    weight: nullable('number'),
    reps: nullable('int'),
    durationSec: nullable('int'),
    rpe: nullable('number'),
    completed: 'boolean',
    completedAt: nullable('timestamp'),
  },
  customExercises: {
    name: 'string',
    primaryMuscle: 'string',
    secondaryMuscles: 'stringArray',
    equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other'],
    trackingType: ['weight_reps', 'reps', 'time'],
    imageUrl: nullable('string'),
  },
} as const satisfies Record<string, Record<string, FieldSpec>>

export type SyncTableName = keyof typeof ROW_SPECS
export const SYNC_TABLE_NAMES = Object.keys(ROW_SPECS) as SyncTableName[]

// ---------------------------------------------------------------------------
// Types

type BaseType<B> = B extends 'string' | 'timestamp' | 'uuid'
  ? string
  : B extends 'int' | 'number'
    ? number
    : B extends 'boolean'
      ? boolean
      : B extends 'stringArray'
        ? string[]
        : B extends readonly (infer E)[]
          ? E
          : never
type FieldType<F> = F extends { readonly nullable: infer B } ? BaseType<B> | null : BaseType<F>

/** Fields every synced row carries; `userId`, `updatedAt` and `version` are owned by the server. */
export interface WireSyncFields {
  id: string
  userId: string
  updatedAt: string
  deletedAt: string | null
  version: number
}
type ServerField = 'userId' | 'updatedAt' | 'version'

/** A full row as the server returns it from pull. */
export type WireRow<T extends SyncTableName> = WireSyncFields & {
  -readonly [K in keyof (typeof ROW_SPECS)[T]]: FieldType<(typeof ROW_SPECS)[T][K]>
}
export type WireRowByTable = { [T in SyncTableName]: WireRow<T> }

/** A row as a client pushes it: server-owned fields may be present but are ignored. */
export type PushRow<T extends SyncTableName> = Omit<WireRow<T>, ServerField> &
  Partial<Pick<WireRow<T>, ServerField>>

export type PushChange = { [T in SyncTableName]: { table: T; rev: number; row: PushRow<T> } }[SyncTableName]

export interface PushRequest {
  contractVersion: number
  changes: PushChange[]
}

export type PushStatus = 'accepted' | 'retryable' | 'rejected'

/**
 * One outcome per pushed change, in request order. `table`, `id` and `rev` echo the change
 * (empty string / 0 when the change was too malformed to carry them).
 */
export interface PushOutcome {
  table: string
  id: string
  rev: number
  status: PushStatus
  /** `invalid:<field>` for a malformed change, `foreign_id` for an id owned by another account. */
  reason?: string
}

export interface PushResponse {
  outcomes: PushOutcome[]
}

/** HTTP 409 body when the client's contract version is below the server minimum. */
export interface ClientOutdatedResponse {
  error: 'client_outdated'
}

export type PullRow = { [T in SyncTableName]: { table: T; row: WireRow<T> } }[SyncTableName]

export interface PullResponse {
  rows: PullRow[]
  /** Highest version included; pass it back as `cursor` on the next pull. */
  cursor: number
  hasMore: boolean
}

// ---------------------------------------------------------------------------
// Validators

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/
const INT_MAX = 2 ** 31 - 1

// Postgres text cannot hold NUL, so such a value would fail the whole push transaction.
const isText = (v: unknown): v is string => typeof v === 'string' && !v.includes('\u0000')

function matchesBase(base: Base, v: unknown): boolean {
  if (typeof base !== 'string') return typeof v === 'string' && base.includes(v)
  switch (base) {
    case 'string':
      return isText(v)
    case 'int':
      return Number.isInteger(v) && Math.abs(v as number) <= INT_MAX
    case 'number':
      return typeof v === 'number' && Number.isFinite(v)
    case 'boolean':
      return typeof v === 'boolean'
    case 'timestamp':
      return typeof v === 'string' && ISO.test(v) && !Number.isNaN(Date.parse(v))
    case 'uuid':
      return typeof v === 'string' && UUID.test(v)
    case 'stringArray':
      return Array.isArray(v) && v.every(isText)
  }
}

function matches(spec: FieldSpec, v: unknown): boolean {
  if (typeof spec === 'object' && 'nullable' in spec) return v === null || matchesBase(spec.nullable, v)
  return matchesBase(spec, v)
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** The first invalid field of a pushed row (`'row'` when it is not an object), or null when valid. */
export function rowProblem(table: SyncTableName, v: unknown): string | null {
  if (!isRecord(v)) return 'row'
  if (!matchesBase('uuid', v.id)) return 'id'
  if (!matches(nullable('timestamp'), v.deletedAt)) return 'deletedAt'
  for (const [field, spec] of Object.entries(ROW_SPECS[table]) as [string, FieldSpec][]) {
    if (!matches(spec, v[field])) return field
  }
  return null
}

/** One type guard per synced table. */
export const rowGuards = Object.fromEntries(
  SYNC_TABLE_NAMES.map((t) => [t, (v: unknown) => rowProblem(t, v) === null]),
) as { [T in SyncTableName]: (v: unknown) => v is PushRow<T> }

export const isSyncTable = (v: unknown): v is SyncTableName =>
  typeof v === 'string' && Object.hasOwn(ROW_SPECS, v)

export type ChangeCheck = { ok: true; change: PushChange } | { ok: false; reason: string }

/** Validates one pushed change; the reason is `invalid:<field>`. */
export function checkChange(v: unknown): ChangeCheck {
  const invalid = (field: string): ChangeCheck => ({ ok: false, reason: `invalid:${field}` })
  if (!isRecord(v)) return invalid('change')
  if (!isSyncTable(v.table)) return invalid('table')
  if (!Number.isInteger(v.rev) || (v.rev as number) < 0) return invalid('rev')
  const problem = rowProblem(v.table, v.row)
  if (problem) return invalid(problem === 'row' ? 'row' : `row.${problem}`)
  return { ok: true, change: v as unknown as PushChange }
}
