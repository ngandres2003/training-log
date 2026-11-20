/**
 * Sign-up invitations (invite links + password). Server-only: never synced to devices.
 *
 * Only the SHA-256 of the link token is stored. An invite is pending while `used_at`,
 * `revoked_at` are null and `expires_at` is in the future.
 */
import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

export const invites = pgTable(
  'invites',
  {
    id: text('id').primaryKey(),
    /** Lowercased. */
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    /** The admin who generated it; null when created from the CLI. */
    createdBy: text('created_by'),
    createdAt: tstz('created_at').defaultNow().notNull(),
    expiresAt: tstz('expires_at').notNull(),
    usedAt: tstz('used_at'),
    revokedAt: tstz('revoked_at'),
    /** The account the invite created or reset. */
    usedBy: text('used_by'),
  },
  (t) => [index('invites_email_idx').on(t.email)],
)
