import { ROW_SPECS, type FieldSpec, type PushRow, type SyncTableName, type WireRow, type WireRowByTable } from '@training-log/contract'
import type { SyncRowByTable } from '@training-log/domain'

// The wire contract and the domain types must describe the same rows.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const contractMatchesDomain: { [T in SyncTableName]: Same<WireRowByTable[T], SyncRowByTable[T]> } = {
  settings: true,
  folders: true,
  routines: true,
  routineExercises: true,
  routineSets: true,
  workouts: true,
  workoutExercises: true,
  workoutSets: true,
  customExercises: true,
}
void contractMatchesDomain

const isTimestamp = (spec: FieldSpec) =>
  spec === 'timestamp' || (typeof spec === 'object' && 'nullable' in spec && spec.nullable === 'timestamp')

const toDate = (v: unknown) => (typeof v === 'string' ? new Date(v) : v)
const toIso = (v: unknown) => (v instanceof Date ? v.toISOString() : v)

/** Table columns of a validated pushed row, timestamps as `Date`. Server-owned fields are left out. */
export function toDbValues(table: SyncTableName, row: PushRow<SyncTableName>): Record<string, unknown> {
  const src = row as unknown as Record<string, unknown>
  const out: Record<string, unknown> = { id: src.id, deletedAt: toDate(src.deletedAt) }
  for (const [field, spec] of Object.entries(ROW_SPECS[table]) as [string, FieldSpec][]) {
    out[field] = isTimestamp(spec) ? toDate(src[field]) : src[field]
  }
  return out
}

/** A stored row in wire form, timestamps as ISO strings. */
export function toWireRow<T extends SyncTableName>(table: T, db: Record<string, unknown>): WireRow<T> {
  const out: Record<string, unknown> = {
    id: db.id,
    userId: db.userId,
    updatedAt: toIso(db.updatedAt),
    deletedAt: toIso(db.deletedAt),
    version: db.version,
  }
  for (const [field, spec] of Object.entries(ROW_SPECS[table]) as [string, FieldSpec][]) {
    out[field] = isTimestamp(spec) ? toIso(db[field]) : db[field]
  }
  return out as WireRow<T>
}
