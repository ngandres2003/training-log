import { MAX_PULL_LIMIT } from '@training-log/contract'
import express, { Router, type RequestHandler } from 'express'
import { sessionOf } from '../auth/require-session.js'
import type { Db } from '../db/client.js'
import { readPull } from './pull.js'
import { applyPush } from './push.js'

export interface SyncRouterDeps {
  getDb: () => Db
  /** `requireSession` for the app's auth instance. */
  requireSession: RequestHandler
}

/** `/api/sync` routes (U6). Bodies are parsed here, after the session check, up to 4 MB. */
export function createSyncRouter({ getDb, requireSession }: SyncRouterDeps): Router {
  const router = Router()

  router.post('/push', requireSession, express.json({ limit: '4mb' }), async (req, res) => {
    const result = await applyPush(getDb(), sessionOf(res).user.id, req.body)
    res.status(result.status).json(result.body)
  })

  router.get('/pull', requireSession, async (req, res) => {
    const cursor = req.query.cursor === undefined ? 0 : Number(req.query.cursor)
    const limit = req.query.limit === undefined ? MAX_PULL_LIMIT : Number(req.query.limit)
    if (!Number.isSafeInteger(cursor) || cursor < 0 || !Number.isInteger(limit) || limit < 1) {
      res.status(400).json({ error: 'bad_request' })
      return
    }
    res.json(await readPull(getDb(), sessionOf(res).user.id, cursor, Math.min(limit, MAX_PULL_LIMIT)))
  })

  return router
}
