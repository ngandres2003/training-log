import express from 'express'
import { createApp } from './app.js'
import { createAuth } from './auth/auth.js'
import { createTestMailer } from './auth/mailer.js'
import { createTestDb } from './db/test-db.js'

/**
 * Test-only API process for the local end-to-end suite (U18). Not imported by `index.ts`, so it
 * is never part of the deployed function. It runs the real app on an in-memory Postgres (PGlite)
 * with a capturing mailer, and adds one route that returns the last code sent to an email.
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
const mailer = createTestMailer()
const auth = createAuth({
  db,
  mailer,
  secret: 'e2e-only-secret-not-for-production-use-000',
  baseURL,
})

const server = express()
// Test mailer sink: the code the app "sent" to this email, if any.
server.get('/api/__e2e/otp', (req, res) => {
  const email = typeof req.query.email === 'string' ? req.query.email : ''
  const code = mailer.lastCodeFor(email)
  if (!code) {
    res.status(404).json({ error: 'no_code' })
    return
  }
  res.json({ code })
})
server.use(createApp({ auth, db }))

server.listen(port, () => {
  console.log(`e2e api listening on http://localhost:${port} (PGlite, test mailer)`)
})
