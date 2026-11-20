import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { Db } from '../db/client.js'
import { invites } from '../db/schema.js'

/** An invite link is valid for 7 days. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type InviteStatus = 'pending' | 'used' | 'expired' | 'revoked'

export interface InviteSummary {
  id: string
  email: string
  createdAt: string
  expiresAt: string
  usedAt: string | null
  status: InviteStatus
}

type InviteRow = typeof invites.$inferSelect

/** 32 random bytes, base64url (43 characters). */
export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Only this is stored: the token itself never reaches the database. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** The SPA route that redeems a token. */
export function invitePath(token: string): string {
  return `/invitacion/${token}`
}

export function statusOf(row: InviteRow, now = new Date()): InviteStatus {
  if (row.usedAt) return 'used'
  if (row.revokedAt) return 'revoked'
  if (row.expiresAt.getTime() <= now.getTime()) return 'expired'
  return 'pending'
}

export function summarize(row: InviteRow, now = new Date()): InviteSummary {
  return {
    id: row.id,
    email: row.email,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    usedAt: row.usedAt?.toISOString() ?? null,
    status: statusOf(row, now),
  }
}

const pendingFor = (email: string, now: Date) =>
  and(eq(invites.email, email), isNull(invites.usedAt), isNull(invites.revokedAt), gt(invites.expiresAt, now))

/**
 * Creates an invite for `email` and revokes that email's earlier pending invites, so only the
 * newest link works. Returns the raw token, which is shown once and never stored.
 */
export async function createInvite(
  db: Db,
  { email, createdBy = null, now = new Date() }: { email: string; createdBy?: string | null; now?: Date },
): Promise<{ token: string; invite: InviteSummary }> {
  const normalized = normalizeEmail(email)
  const token = generateToken()
  const row = await db.transaction(async (tx) => {
    await tx.update(invites).set({ revokedAt: now }).where(pendingFor(normalized, now))
    const [created] = await tx
      .insert(invites)
      .values({
        id: randomUUID(),
        email: normalized,
        tokenHash: hashToken(token),
        createdBy,
        createdAt: now,
        expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
      })
      .returning()
    return created!
  })
  return { token, invite: summarize(row, now) }
}

/** The most recent invites first. */
export async function listInvites(db: Db, limit = 100): Promise<InviteSummary[]> {
  const rows = await db.select().from(invites).orderBy(desc(invites.createdAt)).limit(limit)
  const now = new Date()
  return rows.map((r) => summarize(r, now))
}

/** Revokes a pending invite. False when it does not exist or is no longer pending. */
export async function revokeInvite(db: Db, id: string): Promise<boolean> {
  const now = new Date()
  const rows = await db
    .update(invites)
    .set({ revokedAt: now })
    .where(and(eq(invites.id, id), isNull(invites.usedAt), isNull(invites.revokedAt), gt(invites.expiresAt, now)))
    .returning({ id: invites.id })
  return rows.length > 0
}

/** The invite a token belongs to, or null for an unknown token. */
export async function findByToken(db: Db, token: string): Promise<InviteRow | null> {
  const [row] = await db.select().from(invites).where(eq(invites.tokenHash, hashToken(token)))
  return row ?? null
}

/**
 * Marks a pending invite used, atomically: of two concurrent redeems only one gets the row.
 * Null when the token is unknown or the invite is not pending.
 */
export async function claimInvite(db: Db, token: string): Promise<InviteRow | null> {
  const now = new Date()
  const [row] = await db
    .update(invites)
    .set({ usedAt: now })
    .where(
      and(
        eq(invites.tokenHash, hashToken(token)),
        isNull(invites.usedAt),
        isNull(invites.revokedAt),
        gt(invites.expiresAt, now),
      ),
    )
    .returning()
  return row ?? null
}

/** Undoes `claimInvite` when the account step fails, so the link can be retried. */
export async function releaseInvite(db: Db, id: string): Promise<void> {
  await db.update(invites).set({ usedAt: null }).where(eq(invites.id, id))
}

export async function recordInviteUser(db: Db, id: string, userId: string): Promise<void> {
  await db.update(invites).set({ usedBy: userId }).where(eq(invites.id, id))
}
