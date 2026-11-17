import { toNodeHandler } from 'better-auth/node'
import express, { type Express, type RequestHandler } from 'express'
import { getDefaultAuth, type Auth } from './auth/auth.js'
import { requireSession, sessionOf } from './auth/require-session.js'

export { requireSession, sessionOf }

export interface AppDeps {
  /** Defaults to the production instance, built from the environment on first auth request. */
  auth?: Auth
}

export function createApp(deps: AppDeps = {}): Express {
  const app = express()
  const getAuth = () => deps.auth ?? getDefaultAuth()

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
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
    res.json({ user: { id: user.id, email: user.email } })
  })

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' })
  })

  return app
}
