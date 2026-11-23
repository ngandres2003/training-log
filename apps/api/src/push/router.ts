import { waitUntil as vercelWaitUntil } from '@vercel/functions'
import { and, eq } from 'drizzle-orm'
import express, { Router, type Request, type RequestHandler } from 'express'
import { sessionOf } from '../auth/require-session.js'
import type { Db } from '../db/client.js'
import { pushSubscriptions, restAlerts } from '../db/schema.js'
import {
  deliverRestAlert,
  relaySignature,
  validRelaySignature,
  vapidFromEnv,
  webPushSender,
  type PushSender,
  type VapidConfig,
} from './push.js'

/** The client's in-page alert gets this head start; if it cancels in time, no push is sent. */
export const GRACE_MS = 2_000
/** Longest rest accepted. */
export const MAX_REST_MS = 60 * 60_000
/** Longest wait inside one invocation (functions stop at 300 s); longer waits are relayed. */
export const MAX_WAIT_MS = 240_000

const ID_RE = /^[\w.:-]{1,64}$/
const MAX_TEXT = 120
/** Hosts of the browsers' push services. The server POSTs to the endpoint, so nothing else is allowed. */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^web\.push\.apple\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /\.notify\.windows\.com$/,
]

export function isPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(url.hostname))
  } catch {
    return false
  }
}

const isKey = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 256
const isText = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_TEXT

export interface PushRouterDeps {
  getDb: () => Db
  requireSession: RequestHandler
  /** Defaults to `VAPID_*` from the environment, read per request. */
  getVapid?: () => VapidConfig | null
  send?: PushSender
  /** Keeps the function alive after the response (Vercel); defaults to `@vercel/functions`. */
  waitUntil?: (promise: Promise<unknown>) => void
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  /** Used to hand a long wait to a fresh invocation; defaults to global fetch. */
  fetch?: typeof fetch
}

/**
 * Routes mounted at `/api/push` (rest-end Web Push):
 *
 * - `GET /key` → `{ publicKey }`, or 503 when VAPID keys are not configured.
 * - `POST /subscriptions` `{ endpoint, keys: { p256dh, auth } }`: stores this device for the user.
 * - `DELETE /subscriptions` `{ endpoint }`.
 * - `POST /rest` `{ id, at, title, body }`: replaces the user's pending alert; it is pushed at
 *   `at` + GRACE_MS unless cancelled first. `at` is epoch milliseconds.
 * - `DELETE /rest/:id`: cancels that alert (a newer one is left alone).
 * - `POST /relay` (internal, HMAC-signed): continues a wait longer than one invocation allows.
 */
export function createPushRouter(deps: PushRouterDeps): Router {
  const router = Router()
  const json = express.json({ limit: '8kb' })
  const getVapid = deps.getVapid ?? (() => vapidFromEnv())
  const send = deps.send ?? webPushSender
  const waitUntil = deps.waitUntil ?? vercelWaitUntil
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const now = deps.now ?? Date.now
  const fetchImpl = deps.fetch ?? fetch

  /** Waits for `sendAt` (relaying past MAX_WAIT_MS), then delivers if the alert is still pending. */
  function schedule(userId: string, id: string, sendAt: number, origin: string, vapid: VapidConfig) {
    const wait = Math.max(0, sendAt - now())
    const task = async () => {
      if (wait <= MAX_WAIT_MS) {
        await sleep(wait)
        await deliverRestAlert(deps.getDb(), userId, id, vapid, send)
        return
      }
      await sleep(MAX_WAIT_MS)
      const [pending] = await deps
        .getDb()
        .select({ id: restAlerts.id })
        .from(restAlerts)
        .where(and(eq(restAlerts.userId, userId), eq(restAlerts.id, id)))
      if (!pending) return
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'x-push-relay': relaySignature(vapid.privateKey, userId, id),
      }
      const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      if (bypass) headers['x-vercel-protection-bypass'] = bypass
      const res = await fetchImpl(`${origin}/api/push/relay`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId, id }),
      })
      if (!res.ok) console.error('push relay failed', res.status)
    }
    waitUntil(task().catch((err: unknown) => console.error('rest alert failed', err)))
  }

  router.get('/key', deps.requireSession, (_req, res) => {
    const vapid = getVapid()
    if (!vapid) {
      res.status(503).json({ error: 'push_not_configured' })
      return
    }
    res.json({ publicKey: vapid.publicKey })
  })

  router.post('/subscriptions', deps.requireSession, json, async (req, res, next) => {
    try {
      const { endpoint, keys } = (req.body ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
      if (!isPushEndpoint(endpoint) || !isKey(keys?.p256dh) || !isKey(keys?.auth)) {
        res.status(400).json({ error: 'invalid_subscription' })
        return
      }
      const row = { endpoint, userId: sessionOf(res).user.id, p256dh: keys.p256dh, auth: keys.auth }
      await deps
        .getDb()
        .insert(pushSubscriptions)
        .values(row)
        .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: row.userId, p256dh: row.p256dh, auth: row.auth } })
      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  router.delete('/subscriptions', deps.requireSession, json, async (req, res, next) => {
    try {
      const endpoint = (req.body as { endpoint?: unknown } | undefined)?.endpoint
      if (typeof endpoint !== 'string') {
        res.status(400).json({ error: 'invalid_subscription' })
        return
      }
      await deps
        .getDb()
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, sessionOf(res).user.id)))
      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  router.post('/rest', deps.requireSession, json, async (req, res, next) => {
    try {
      const vapid = getVapid()
      if (!vapid) {
        res.status(503).json({ error: 'push_not_configured' })
        return
      }
      const { id, at, title, body } = (req.body ?? {}) as Record<string, unknown>
      const t = now()
      if (
        typeof id !== 'string' ||
        !ID_RE.test(id) ||
        typeof at !== 'number' ||
        !Number.isFinite(at) ||
        at < t - GRACE_MS ||
        at > t + MAX_REST_MS ||
        !isText(title) ||
        !isText(body)
      ) {
        res.status(400).json({ error: 'invalid_rest' })
        return
      }
      const userId = sessionOf(res).user.id
      const sendAt = new Date(at + GRACE_MS)
      await deps
        .getDb()
        .insert(restAlerts)
        .values({ userId, id, sendAt, title, body })
        .onConflictDoUpdate({ target: restAlerts.userId, set: { id, sendAt, title, body } })
      schedule(userId, id, sendAt.getTime(), originOf(req), vapid)
      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  router.delete('/rest/:id', deps.requireSession, async (req, res, next) => {
    try {
      await deps
        .getDb()
        .delete(restAlerts)
        .where(and(eq(restAlerts.userId, sessionOf(res).user.id), eq(restAlerts.id, String(req.params.id))))
      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  router.post('/relay', json, async (req, res, next) => {
    try {
      const vapid = getVapid()
      const { userId, id } = (req.body ?? {}) as { userId?: unknown; id?: unknown }
      const signature = req.get('x-push-relay')
      if (
        !vapid ||
        typeof userId !== 'string' ||
        typeof id !== 'string' ||
        !signature ||
        !validRelaySignature(vapid.privateKey, userId, id, signature)
      ) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const [alert] = await deps
        .getDb()
        .select()
        .from(restAlerts)
        .where(and(eq(restAlerts.userId, userId), eq(restAlerts.id, id)))
      if (alert) schedule(userId, id, alert.sendAt.getTime(), originOf(req), vapid)
      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  return router
}

/** The public origin this request came in on (Vercel sets x-forwarded-proto). */
function originOf(req: Request): string {
  const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol
  return `${proto}://${req.get('host')}`
}
