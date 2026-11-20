import { fromNodeHeaders } from 'better-auth/node'
import { inArray } from 'drizzle-orm'
import express, { Router, type RequestHandler, type Response } from 'express'
import { isAdminEmail } from '../auth/admins.js'
import { MIN_PASSWORD_LENGTH, RATE_WINDOW_SEC, signInLimitKeys, type Auth } from '../auth/auth.js'
import { clientIp, consumeRateLimit } from '../auth/rate-limit.js'
import { sessionOf } from '../auth/require-session.js'
import type { Db } from '../db/client.js'
import { rateLimit } from '../db/schema.js'
import { createInvite, findByToken, invitePath, listInvites, normalizeEmail, revokeInvite, statusOf } from './invites.js'
import { redeemInvite } from './redeem.js'

const MAX_PASSWORD_LENGTH = 128
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Per IP and per RATE_WINDOW_SEC. Tokens are 256-bit, so these only curb abuse. */
const CHECKS_PER_IP = 30
const REDEEMS_PER_IP = 10
/** Per admin and per RATE_WINDOW_SEC. */
const CREATES_PER_ADMIN = 30

export interface InvitesRouterDeps {
  getDb: () => Db
  getAuth: () => Auth
  /** `requireSession` for the app's auth instance. */
  requireSession: RequestHandler
  /** Lowercased admin emails; read per request. */
  getAdminEmails: () => string[]
}

function tooMany(res: Response, retryAfter: number) {
  res.setHeader('X-Retry-After', String(retryAfter))
  res.status(429).json({ error: 'rate_limited' })
}

/**
 * Routes mounted at `/api/invites`. Invite-only sign-up and password reset:
 *
 * - `POST /` (admin) `{ email }` → `{ invite, path }`: a new 7-day link for the email; earlier
 *   pending links for it stop working. `path` is `/invitacion/<token>`, joined to the app origin
 *   by the client. The token is never stored, only its hash.
 * - `GET /` (admin) → `{ invites }`: the latest invites with their status.
 * - `DELETE /:id` (admin) → revokes a pending invite.
 * - `POST /check` (public) `{ token }` → `{ email, status, hasAccount }` for the invitation page.
 * - `POST /redeem` (public) `{ token, password }` → creates the account, or sets a new password on
 *   the existing one, then signs in (session cookie, as `/api/auth/sign-in/email` does).
 *
 * Admins are the emails in `ADMIN_EMAILS`, checked here on every request.
 */
export function createInvitesRouter(deps: InvitesRouterDeps): Router {
  const router = Router()
  const json = express.json({ limit: '10kb' })

  const requireAdmin: RequestHandler = (_req, res, next) => {
    if (!isAdminEmail(sessionOf(res).user.email, deps.getAdminEmails())) {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    next()
  }
  const admin = [deps.requireSession, requireAdmin]

  router.post('/', ...admin, json, async (req, res, next) => {
    try {
      const email = typeof req.body?.email === 'string' ? normalizeEmail(req.body.email) : ''
      if (!EMAIL_RE.test(email) || email.length > 254) {
        res.status(400).json({ error: 'invalid_email' })
        return
      }
      const adminId = sessionOf(res).user.id
      const wait = await consumeRateLimit(deps.getDb(), `invite-create:${adminId}`, RATE_WINDOW_SEC, CREATES_PER_ADMIN)
      if (wait !== null) return tooMany(res, wait)
      const { token, invite } = await createInvite(deps.getDb(), { email, createdBy: adminId })
      res.status(201).json({ invite, path: invitePath(token) })
    } catch (err) {
      next(err)
    }
  })

  router.get('/', ...admin, async (_req, res, next) => {
    try {
      res.json({ invites: await listInvites(deps.getDb()) })
    } catch (err) {
      next(err)
    }
  })

  router.delete('/:id', ...admin, async (req, res, next) => {
    try {
      const ok = await revokeInvite(deps.getDb(), String(req.params.id))
      if (!ok) {
        res.status(404).json({ error: 'not_pending' })
        return
      }
      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  router.post('/check', json, async (req, res, next) => {
    try {
      const wait = await consumeRateLimit(deps.getDb(), `invite-check:${clientIp(req)}`, RATE_WINDOW_SEC, CHECKS_PER_IP)
      if (wait !== null) return tooMany(res, wait)
      const token = typeof req.body?.token === 'string' ? req.body.token : ''
      const row = token ? await findByToken(deps.getDb(), token) : null
      if (!row) {
        res.status(404).json({ error: 'invite_invalid' })
        return
      }
      const ctx = await deps.getAuth().$context
      const hasAccount = !!(await ctx.internalAdapter.findUserByEmail(row.email))
      res.json({ email: row.email, status: statusOf(row), hasAccount })
    } catch (err) {
      next(err)
    }
  })

  router.post('/redeem', json, async (req, res, next) => {
    try {
      const ip = clientIp(req)
      const db = deps.getDb()
      const wait = await consumeRateLimit(db, `invite-redeem:${ip}`, RATE_WINDOW_SEC, REDEEMS_PER_IP)
      if (wait !== null) return tooMany(res, wait)
      const token = typeof req.body?.token === 'string' ? req.body.token : ''
      const password = typeof req.body?.password === 'string' ? req.body.password : ''
      if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
        res.status(400).json({ error: 'invalid_password' })
        return
      }
      if (!token) {
        res.status(404).json({ error: 'invite_invalid' })
        return
      }

      const auth = deps.getAuth()
      const result = await redeemInvite(auth, db, token, password)
      if (!result.ok) {
        res.status(result.error === 'invite_invalid' ? 404 : 410).json({ error: result.error })
        return
      }

      // A new password clears this email's failed sign-in counters, so the sign-in below works.
      const keys = signInLimitKeys(result.email, ip)
      await db.delete(rateLimit).where(inArray(rateLimit.key, [keys.perEmailAndIp, keys.perEmail]))
      const { headers } = await auth.api.signInEmail({
        body: { email: result.email, password },
        headers: fromNodeHeaders(req.headers),
        returnHeaders: true,
      })
      for (const cookie of headers.getSetCookie()) res.append('Set-Cookie', cookie)
      res.json({ user: { id: result.userId, email: result.email }, created: result.created })
    } catch (err) {
      next(err)
    }
  })

  return router
}
