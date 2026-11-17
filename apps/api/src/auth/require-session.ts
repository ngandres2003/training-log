import { fromNodeHeaders } from 'better-auth/node'
import type { RequestHandler, Response } from 'express'
import type { Auth } from './auth.js'

export type SessionData = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>

/**
 * Resolves the session for every non-auth API route and answers 401 without one.
 * Handlers read the user with `sessionOf(res)` and never trust a client `userId`.
 */
export function requireSession(getAuth: () => Auth): RequestHandler {
  return async (req, res, next) => {
    try {
      const data = await getAuth().api.getSession({ headers: fromNodeHeaders(req.headers) })
      if (!data) {
        res.status(401).json({ error: 'unauthorized' })
        return
      }
      res.locals.session = data
      next()
    } catch (err) {
      next(err)
    }
  }
}

/** The session resolved by `requireSession` for this request. */
export function sessionOf(res: Response): SessionData {
  const data = res.locals.session as SessionData | undefined
  if (!data) throw new Error('sessionOf called on a route without requireSession')
  return data
}
