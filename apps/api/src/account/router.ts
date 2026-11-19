import { fromNodeHeaders } from 'better-auth/node'
import { Router, type RequestHandler } from 'express'
import type { Auth } from '../auth/auth.js'
import { sessionOf } from '../auth/require-session.js'
import type { Db } from '../db/client.js'
import { deleteUserPhotos, deleteUserRows, vercelBlob, type BlobClient } from './delete.js'

export interface AccountRouterDeps {
  getDb: () => Db
  getAuth: () => Auth
  /** `requireSession` for the app's auth instance. */
  requireSession: RequestHandler
  /** Vercel Blob read-write token; defaults to `process.env.BLOB_READ_WRITE_TOKEN` at request time. */
  blobToken?: string
  /** Defaults to `@vercel/blob`. */
  blob?: BlobClient
}

/**
 * Routes mounted at `/api/account` (U15).
 *
 * `DELETE /` ("Borrar todos mis datos"): deletes the session user's rows from every synced table
 * and their sync counter, every Blob object under `custom-exercises/<userId>/`, and every other
 * session of the user. The account and the requesting session are kept. Answers `{ ok: true }`.
 * Safe to retry: each step is idempotent.
 */
export function createAccountRouter(deps: AccountRouterDeps): Router {
  const router = Router()
  const blob = deps.blob ?? vercelBlob

  router.delete('/', deps.requireSession, async (req, res, next) => {
    try {
      const token = deps.blobToken ?? process.env.BLOB_READ_WRITE_TOKEN
      if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not set')
      const userId = sessionOf(res).user.id

      await deleteUserRows(deps.getDb(), userId)
      await deleteUserPhotos(blob, userId, token)
      await deps.getAuth().api.revokeOtherSessions({ headers: fromNodeHeaders(req.headers) })
      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  return router
}
