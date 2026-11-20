import express, { Router } from 'express'
import type { Auth } from '../auth/auth.js'
import { requireSession, sessionOf } from '../auth/require-session.js'
import { isPhotoContentType, issuePhotoUploadToken, MAX_PHOTO_BYTES } from './token.js'

export interface UploadsRouterDeps {
  getAuth: () => Auth
  /** Vercel Blob read-write token; defaults to `process.env.BLOB_READ_WRITE_TOKEN` at request time. */
  blobToken?: string
}

/**
 * Routes mounted at `/api/uploads`.
 *
 * `POST /token` with `{ contentType: 'image/webp' | 'image/jpeg', size?: number }` answers
 * `{ token, pathname }`; the client uploads with `put(pathname, blob, { access: 'public', token })`
 * from `@vercel/blob/client`. Any client-supplied pathname is ignored.
 */
export function createUploadsRouter(deps: UploadsRouterDeps): Router {
  const router = Router()

  router.post('/token', requireSession(deps.getAuth), express.json(), async (req, res, next) => {
    try {
      const body = (req.body ?? {}) as { contentType?: unknown; size?: unknown }
      if (!isPhotoContentType(body.contentType)) {
        res.status(400).json({ error: 'unsupported_content_type' })
        return
      }
      if (typeof body.size === 'number' && body.size > MAX_PHOTO_BYTES) {
        res.status(400).json({ error: 'too_large' })
        return
      }
      const readWriteToken = deps.blobToken ?? process.env.BLOB_READ_WRITE_TOKEN
      if (!readWriteToken) throw new Error('BLOB_READ_WRITE_TOKEN is not set')

      const { user } = sessionOf(res)
      res.json(await issuePhotoUploadToken({ userId: user.id, contentType: body.contentType, readWriteToken }))
    } catch (err) {
      next(err)
    }
  })

  return router
}
