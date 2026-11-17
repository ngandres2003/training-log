import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { createDb, type Db } from '../db/client.js'
import { account, rateLimit, session, user, verification } from '../db/schema.js'
import { createResendMailer, type Mailer } from './mailer.js'

const SEND_OTP_PATH = '/email-otp/send-verification-otp'
const SEND_WINDOW_SEC = 15 * 60
const SENDS_PER_EMAIL = 3
const SENDS_PER_IP = 10

export interface AuthDeps {
  db: Db
  mailer: Mailer
  /** Defaults to `BETTER_AUTH_SECRET`. */
  secret?: string
  /** Defaults to `BETTER_AUTH_URL`. */
  baseURL?: string
}

/**
 * Better Auth with email codes (U3, KTD3). Built from a factory so tests run it on PGlite
 * with a capturing mailer.
 */
export function createAuth({ db, mailer, secret, baseURL }: AuthDeps) {
  const production = process.env.NODE_ENV === 'production'
  return betterAuth({
    secret: secret ?? process.env.BETTER_AUTH_SECRET,
    baseURL: baseURL ?? process.env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification, rateLimit },
    }),
    session: {
      expiresIn: 60 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    rateLimit: {
      enabled: true,
      // Shared by every serverless instance, unlike the in-memory default (KTD3).
      storage: 'database',
      customRules: {
        // Per IP. The per-email limit is the `hooks.before` below.
        [SEND_OTP_PATH]: { window: SEND_WINDOW_SEC, max: SENDS_PER_IP },
        // Room for the 5 attempts a code allows; the default is 3 per minute.
        '/sign-in/email-otp': { window: 60, max: 10 },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== SEND_OTP_PATH) return
        const email = typeof ctx.body?.email === 'string' ? ctx.body.email.toLowerCase() : ''
        if (!email) return
        const retryAfter = await consumeEmailSend(db, email)
        if (retryAfter !== null) {
          throw new APIError(
            'TOO_MANY_REQUESTS',
            { message: 'Too many codes requested for this email.', code: 'TOO_MANY_CODE_REQUESTS' },
            { 'X-Retry-After': String(retryAfter) },
          )
        }
      }),
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 5,
        // Plain only outside production, so end-to-end tests can read codes (U18).
        storeOTP: production ? 'hashed' : 'plain',
        async sendVerificationOTP({ email, otp }) {
          await mailer.sendOtp({ email, otp })
        },
      }),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>

/**
 * Counts one code request for `email` in a fixed 15-minute window, atomically in the
 * `rate_limit` table so every instance sees it. Returns the seconds to wait when over the
 * limit, otherwise null. `last_request` holds the window start for these keys; Better Auth
 * prunes rows older than its longest configured window (also 15 minutes).
 */
async function consumeEmailSend(db: Db, email: string): Promise<number | null> {
  const now = Date.now()
  const windowMs = SEND_WINDOW_SEC * 1000
  const expired = sql`${rateLimit.lastRequest} <= ${now - windowMs}`
  const [row] = await db
    .insert(rateLimit)
    .values({ id: randomUUID(), key: `email-otp-send:${email}`, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimit.count} + 1 end`,
        lastRequest: sql`case when ${expired} then ${now} else ${rateLimit.lastRequest} end`,
      },
    })
    .returning({ count: rateLimit.count, windowStart: rateLimit.lastRequest })
  if (!row || row.count <= SENDS_PER_EMAIL) return null
  return Math.max(1, Math.ceil((row.windowStart + windowMs - now) / 1000))
}

let defaultAuth: Auth | undefined

/** The production instance, built on first use from the environment. */
export function getDefaultAuth(): Auth {
  if (!defaultAuth) {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.EMAIL_FROM
    if (!apiKey || !from) throw new Error('RESEND_API_KEY and EMAIL_FROM must be set')
    defaultAuth = createAuth({ db: createDb().db, mailer: createResendMailer({ apiKey, from }) })
  }
  return defaultAuth
}
