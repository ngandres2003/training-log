import express from 'express'
import { createApp } from './app.js'
import { createAuth } from './auth/auth.js'
import { createTestDb } from './db/test-db.js'
import { createInvite, invitePath } from './invites/invites.js'

/**
 * Test-only API process for the local end-to-end suite (U18). Not imported by `index.ts`, so it
 * is never part of the deployed function. It runs the real app on an in-memory Postgres (PGlite)
 * and adds one route that mints an invite link for an email, as an admin would.
 *
 * Refuses to start unless `E2E_TEST_MODE=1` and `NODE_ENV` is not `production`.
 */
if (process.env.E2E_TEST_MODE !== '1' || process.env.NODE_ENV === 'production') {
  console.error('e2e-server only runs with E2E_TEST_MODE=1 outside production')
  process.exit(1)
}

const port = Number(process.env.PORT ?? 3101)
const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:4174'

const { db } = await createTestDb()
const auth = createAuth({
  db,
  secret: 'e2e-only-secret-not-for-production-use-000',
  baseURL,
})

const server = express()
// Stands in for an admin generating a link: `{ email }` → `{ path }` (`/invitacion/<token>`).
server.post('/api/__e2e/invite', express.json(), async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email : ''
    if (!email) {
      res.status(400).json({ error: 'email_required' })
      return
    }
    const { token } = await createInvite(db, { email })
    res.json({ path: invitePath(token) })
  } catch (err) {
    next(err)
  }
})
server.use(createApp({ auth, db }))

server.listen(port, () => {
  console.log(`e2e api listening on http://localhost:${port} (PGlite)`)
})
