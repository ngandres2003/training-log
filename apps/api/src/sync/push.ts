import {
  MAX_PUSH_CHANGES,
  MIN_SUPPORTED_CONTRACT_VERSION,
  checkChange,
  type PushChange,
  type PushOutcome,
} from '@training-log/contract'
import { and, eq, or } from 'drizzle-orm'
import type { Db, Tx } from '../db/client.js'
import { nextVersions, syncTables } from '../db/queries.js'
import { settings } from '../db/schema.js'
import { toDbValues } from './rows.js'

export type PushResult =
  | { status: 200; body: { outcomes: PushOutcome[] } }
  | { status: 400; body: { error: 'bad_request' } }
  | { status: 409; body: { error: 'client_outdated' } }
  | { status: 413; body: { error: 'too_many_changes'; max: number } }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/**
 * Applies one push for `userId` (KTD5). The contract version is checked first. Valid changes are
 * written in one transaction that reserves their versions from the user's counter (locking it
 * until commit) and stamps server `updatedAt`. `userId` always comes from the session.
 */
export async function applyPush(db: Db, userId: string, body: unknown): Promise<PushResult> {
  if (!isRecord(body)) return { status: 400, body: { error: 'bad_request' } }
  const version = body.contractVersion
  if (typeof version !== 'number' || !(version >= MIN_SUPPORTED_CONTRACT_VERSION)) {
    return { status: 409, body: { error: 'client_outdated' } }
  }
  if (!Array.isArray(body.changes)) return { status: 400, body: { error: 'bad_request' } }
  if (body.changes.length > MAX_PUSH_CHANGES) {
    return { status: 413, body: { error: 'too_many_changes', max: MAX_PUSH_CHANGES } }
  }

  const outcomes: PushOutcome[] = []
  const valid: { change: PushChange; outcome: PushOutcome }[] = []
  for (const raw of body.changes as unknown[]) {
    const r = isRecord(raw) ? raw : {}
    const row = isRecord(r.row) ? r.row : {}
    const outcome: PushOutcome = {
      table: typeof r.table === 'string' ? r.table : '',
      id: typeof row.id === 'string' ? row.id : '',
      rev: typeof r.rev === 'number' ? r.rev : 0,
      status: 'accepted',
    }
    const check = checkChange(raw)
    if (check.ok) valid.push({ change: check.change, outcome })
    else Object.assign(outcome, { status: 'rejected', reason: check.reason })
    outcomes.push(outcome)
  }

  if (valid.length > 0) {
    await db.transaction(async (tx) => {
      const versions = await nextVersions(tx, userId, valid.length)
      const now = new Date()
      for (const [i, { change, outcome }] of valid.entries()) {
        const values = { ...toDbValues(change.table, change.row), userId, version: versions[i]!, updatedAt: now }
        const ok =
          change.table === 'settings' ? await upsertSettings(tx, userId, values) : await upsert(tx, change, userId, values)
        if (!ok) Object.assign(outcome, { status: 'rejected', reason: 'foreign_id' })
      }
    })
  }
  return { status: 200, body: { outcomes } }
}

/** Insert or overwrite by id; an id owned by another user matches no row and is left alone. */
async function upsert(tx: Tx, change: PushChange, userId: string, values: Record<string, unknown>): Promise<boolean> {
  const pg = syncTables[change.table] as typeof syncTables.folders
  const { id: _id, ...set } = values
  const written = await tx
    .insert(pg)
    .values(values as never)
    .onConflictDoUpdate({ target: pg.id, set: set as never, setWhere: eq(pg.userId, userId) })
    .returning({ id: pg.id })
  return written.length === 1
}

/**
 * Settings are one row per user. A row pushed with a new id while the user already has one
 * (two devices set up offline) overwrites the existing row, which keeps its id.
 */
async function upsertSettings(tx: Tx, userId: string, values: Record<string, unknown>): Promise<boolean> {
  const id = values.id as string
  const existing = await tx
    .select({ id: settings.id, userId: settings.userId })
    .from(settings)
    .where(or(eq(settings.id, id), eq(settings.userId, userId)))
  if (existing.some((r) => r.id === id && r.userId !== userId)) return false
  const mine = existing.find((r) => r.userId === userId)
  const { id: _id, ...set } = values
  if (mine) {
    await tx
      .update(settings)
      .set(set as never)
      .where(and(eq(settings.id, mine.id), eq(settings.userId, userId)))
  } else {
    await tx.insert(settings).values(values as never)
  }
  return true
}
