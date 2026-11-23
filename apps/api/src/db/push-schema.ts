/**
 * Web Push (rest-end notifications). Server-only: never synced to devices.
 *
 * - `push_subscriptions`: one row per browser/device that allowed notifications. The endpoint
 *   is unique; a device that signs in as another user moves its row to that user.
 * - `rest_alerts`: at most one pending rest-end alert per user. `id` is chosen by the client so
 *   a late cancel for an old rest never removes the newer one.
 */
import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    endpoint: text('endpoint').primaryKey(),
    userId: text('user_id').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: tstz('created_at').defaultNow().notNull(),
  },
  (t) => [index('push_subscriptions_user_idx').on(t.userId)],
)

export const restAlerts = pgTable('rest_alerts', {
  userId: text('user_id').primaryKey(),
  id: text('id').notNull(),
  sendAt: tstz('send_at').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
})
