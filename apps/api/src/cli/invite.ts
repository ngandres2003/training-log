/**
 * Creates an invite link from the command line (bootstraps the first admin, or any account,
 * without the app):
 *
 *   DATABASE_URL=... pnpm --filter api invite <email> [--base-url https://your-app.vercel.app]
 *
 * The base URL defaults to `BETTER_AUTH_URL`. Prints the link; earlier pending links for the
 * email stop working. The link lasts 7 days and works once.
 */
import { parseArgs } from 'node:util'
import { createDb } from '../db/client.js'
import { createInvite, invitePath, normalizeEmail } from '../invites/invites.js'

const USAGE = 'Usage: pnpm --filter api invite <email> [--base-url https://your-app.example]'

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { 'base-url': { type: 'string' }, help: { type: 'boolean', short: 'h' } },
  })
  if (values.help) {
    console.log(USAGE)
    return 0
  }
  const email = normalizeEmail(positionals[0] ?? '')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(USAGE)
    return 1
  }
  const baseUrl = (values['base-url'] ?? process.env.BETTER_AUTH_URL ?? '').replace(/\/+$/, '')
  if (!/^https?:\/\//.test(baseUrl)) {
    console.error('Set --base-url (or BETTER_AUTH_URL) to the app origin, e.g. https://your-app.vercel.app')
    return 1
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set (the production Neon connection string).')
    return 1
  }

  const { db, pool } = createDb()
  try {
    const { token, invite } = await createInvite(db, { email })
    console.log(`Invitación para ${invite.email} (caduca ${invite.expiresAt}):`)
    console.log(`${baseUrl}${invitePath(token)}`)
    return 0
  } finally {
    await pool.end()
  }
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err)
    process.exit(1)
  },
)
