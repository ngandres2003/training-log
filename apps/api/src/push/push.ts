import { createHmac, timingSafeEqual } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import webpush from 'web-push'
import type { Db } from '../db/client.js'
import { pushSubscriptions, restAlerts } from '../db/schema.js'

export interface VapidConfig {
  publicKey: string
  privateKey: string
  /** `mailto:` or `https:` contact the push services can reach (Apple rejects localhost). */
  subject: string
}

/** VAPID keys from the environment, or null when push is not configured. */
export function vapidFromEnv(env: NodeJS.ProcessEnv = process.env): VapidConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = env.VAPID_PRIVATE_KEY?.trim()
  const subject = (env.VAPID_SUBJECT ?? env.BETTER_AUTH_URL)?.trim()
  if (!publicKey || !privateKey || !subject) return null
  return { publicKey, privateKey, subject }
}

export interface StoredSubscription {
  endpoint: string
  p256dh: string
  auth: string
}

/** Sends one encrypted push. Rejects with `{ statusCode }` like `web-push` does. */
export type PushSender = (sub: StoredSubscription, payload: string, vapid: VapidConfig) => Promise<void>

export const webPushSender: PushSender = async (sub, payload, vapid) => {
  await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
    vapidDetails: vapid,
    // A rest-end alert is worthless a minute late; drop it if the device stays offline.
    TTL: 60,
    urgency: 'high',
    topic: 'rest-end',
  })
}

/** The push payload the service worker reads (sw.ts). */
export interface RestEndPayload {
  type: 'rest-end'
  title: string
  body: string
}

/**
 * Claims the user's pending alert `id` (deleting it, so only one delivery wins) and pushes it
 * to every subscription of the user. Subscriptions the push service reports gone are removed.
 * Returns how many pushes were accepted.
 */
export async function deliverRestAlert(
  db: Db,
  userId: string,
  id: string,
  vapid: VapidConfig,
  send: PushSender,
): Promise<number> {
  const [alert] = await db
    .delete(restAlerts)
    .where(and(eq(restAlerts.userId, userId), eq(restAlerts.id, id)))
    .returning()
  if (!alert) return 0

  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId))
  const payload = JSON.stringify({ type: 'rest-end', title: alert.title, body: alert.body } satisfies RestEndPayload)
  let sent = 0
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await send(sub, payload, vapid)
        sent++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint))
        } else {
          console.error('push failed', status ?? err)
        }
      }
    }),
  )
  return sent
}

/** HMAC that lets the API hand a long wait over to a fresh invocation of itself. */
export function relaySignature(secret: string, userId: string, id: string): string {
  return createHmac('sha256', secret).update(`${userId}\n${id}`).digest('base64url')
}

export function validRelaySignature(secret: string, userId: string, id: string, signature: string): boolean {
  const expected = Buffer.from(relaySignature(secret, userId, id))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}
