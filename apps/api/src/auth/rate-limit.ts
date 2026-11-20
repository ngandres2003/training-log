import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { isIP } from 'node:net'
import type { Request } from 'express'
import type { Db } from '../db/client.js'
import { rateLimit } from '../db/schema.js'

/**
 * Counts one request for `key` in a fixed window, atomically in the `rate_limit` table so every
 * serverless instance sees it (KTD3). Returns the seconds to wait when over `max`, otherwise null.
 * `last_request` holds the window start for these keys. Better Auth prunes rows older than its
 * longest configured window, so `windowSec` must not exceed it (15 minutes, see auth.ts).
 */
export async function consumeRateLimit(
  db: Db,
  key: string,
  windowSec: number,
  max: number,
): Promise<number | null> {
  const now = Date.now()
  const windowMs = windowSec * 1000
  const expired = sql`${rateLimit.lastRequest} <= ${now - windowMs}`
  const [row] = await db
    .insert(rateLimit)
    .values({ id: randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimit.count} + 1 end`,
        lastRequest: sql`case when ${expired} then ${now} else ${rateLimit.lastRequest} end`,
      },
    })
    .returning({ count: rateLimit.count, windowStart: rateLimit.lastRequest })
  if (!row || row.count <= max) return null
  return Math.max(1, Math.ceil((row.windowStart + windowMs - now) / 1000))
}

/**
 * Headers the client IP is read from, in order. Vercel sets both and overwrites any value the
 * client sent, so they are trustworthy there. Shared with Better Auth (`advanced.ipAddress`).
 */
export const UNKNOWN_IP = 'unknown'

export const IP_HEADERS = ['x-real-ip', 'x-forwarded-for'] as const

type HeaderSource = Headers | Record<string, string | string[] | undefined>

/**
 * The client IP the way Better Auth resolves it: the first header in `IP_HEADERS` that holds a
 * single valid address. Null when none does (a chain of proxies is not trusted).
 */
export function ipFromHeaders(headers: HeaderSource | undefined): string | null {
  if (!headers) return null
  for (const key of IP_HEADERS) {
    const raw = headers instanceof Headers ? headers.get(key) : headers[key]
    const value = Array.isArray(raw) ? raw[0] : raw
    const ip = value?.trim()
    if (ip && !ip.includes(',') && isIP(ip)) return ip.toLowerCase()
  }
  return null
}

/** The request's client IP for rate-limit keys; 'unknown' (one shared bucket) without one. */
export function clientIp(req: Pick<Request, 'headers'>): string {
  return ipFromHeaders(req.headers) ?? UNKNOWN_IP
}
