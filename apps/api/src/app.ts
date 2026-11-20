import { toNodeHandler } from 'better-auth/node'
import express, { type Express, type RequestHandler } from 'express'
import { getDefaultAuth, type Auth } from './auth/auth.js'
import { requireSession, sessionOf } from './auth/require-session.js'
import { createDb, type Db } from './db/client.js'
import { createSyncRouter } from './sync/router.js'
import { createUploadsRouter } from './uploads/router.js'
import { createAccountRouter } from './account/router.js'
import { adminEmailsFromEnv, isAdminEmail } from './auth/admins.js'
import { createInvitesRouter } from './invites/router.js'

export { requireSession, sessionOf }

export interface AppDeps {
  /** Defaults to the production instance, built from the environment on first auth request. */
  auth?: Auth
  /** Defaults to Drizzle on Neon from `DATABASE_URL`, built on first sync request. */
  db?: Db
  /** Admin emails (lowercased). Defaults to `ADMIN_EMAILS`, read on every request. */
  adminEmails?: string[]
}

export function createApp(deps: AppDeps = {}): Express {
  const app = express()
  app.disable('x-powered-by')
  let defaultDb: Db | undefined
  const getDb = () => deps.db ?? (defaultDb ??= createDb().db)
  // Auth and sync share one Neon pool.
  const getAuth = () => deps.auth ?? getDefaultAuth(getDb())
  const getAdminEmails = () => deps.adminEmails ?? adminEmailsFromEnv()

  app.get('/api/health', (_req, res) => {
    // `version` lets CI wait until a deployment serves a given commit (Vercel sets the SHA).
    res.json({ ok: true, version: process.env.VERCEL_GIT_COMMIT_SHA ?? null })
  })

  // Better Auth reads the raw body itself, so it is mounted before any JSON parser.
  let authHandler: RequestHandler | undefined
  app.all('/api/auth/*splat', (req, res, next) => {
    try {
      authHandler ??= toNodeHandler(getAuth()) as unknown as RequestHandler
    } catch (err) {
      next(err)
      return
    }
    authHandler(req, res, next)
  })

  const auth = requireSession(getAuth)

  app.get('/api/me', auth, (_req, res) => {
    const { user } = sessionOf(res)
    res.json({ user: { id: user.id, email: user.email }, isAdmin: isAdminEmail(user.email, getAdminEmails()) })
  })

  app.use('/api/sync', createSyncRouter({ getDb, requireSession: auth }))
  app.use('/api/uploads', createUploadsRouter({ getAuth }))
  app.use('/api/invites', createInvitesRouter({ getDb, getAuth, requireSession: auth, getAdminEmails }))
  app.use('/api/account', createAccountRouter({ getDb, getAuth, requireSession: auth }))

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' })
  })

  return app
}
