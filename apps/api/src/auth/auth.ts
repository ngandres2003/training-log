import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { createDb, type Db } from '../db/client.js'
import { account, rateLimit, session, user, verification } from '../db/schema.js'
import { consumeRateLimit, IP_HEADERS, ipFromHeaders, UNKNOWN_IP } from './rate-limit.js'

export const SIGN_IN_PATH = '/sign-in/email'
/** Longest rate-limit window; Better Auth prunes `rate_limit` rows older than this. */
export const RATE_WINDOW_SEC = 15 * 60
/** Attempts per email from one IP, and per email from all IPs, per RATE_WINDOW_SEC. */
const SIGN_INS_PER_EMAIL_AND_IP = 5
const SIGN_INS_PER_EMAIL = 30
export const MIN_PASSWORD_LENGTH = 8

/** The `rate_limit` keys of the sign-in limits for `email` (lowercased) from `ip`. */
export function signInLimitKeys(email: string, ip: string) {
  return { perEmailAndIp: `sign-in:${ip}:${email}`, perEmail: `sign-in:${email}` }
}

export interface AuthDeps {
  db: Db
  /** Defaults to `BETTER_AUTH_SECRET`. */
  secret?: string
  /** Defaults to `BETTER_AUTH_URL`. */
  baseURL?: string
}

/**
 * Better Auth with email + password and no self sign-up. Accounts are only created, and
 * passwords only reset, by redeeming an invite link (`src/invites`). Built from a factory so
 * tests run it on PGlite.
 */
export function createAuth({ db, secret, baseURL }: AuthDeps) {
  return betterAuth({
    secret: secret ?? process.env.BETTER_AUTH_SECRET,
    baseURL: baseURL ?? process.env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification, rateLimit },
    }),
    emailAndPassword: {
      enabled: true,
      // Invite-only: `/sign-up/email` answers 400 EMAIL_PASSWORD_SIGN_UP_DISABLED.
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: 128,
    },
    advanced: {
      // Per-client buckets instead of one shared bucket per path (see IP_HEADERS).
      ipAddress: { ipAddressHeaders: [...IP_HEADERS] },
    },
    session: {
      // 60 days, renewed once a day of use (KTD3).
      expiresIn: 60 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    rateLimit: {
      enabled: true,
      // Shared by every serverless instance, unlike the in-memory default (KTD3).
      storage: 'database',
      customRules: {
        // Per IP. The per email+IP and per email limits are the `hooks.before` below.
        [SIGN_IN_PATH]: { window: 60, max: 10 },
        // Keeps RATE_WINDOW_SEC the longest window, so the custom keys below are not pruned early.
        '/sign-up/email': { window: RATE_WINDOW_SEC, max: 10 },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== SIGN_IN_PATH) return
        const email = typeof ctx.body?.email === 'string' ? ctx.body.email.trim().toLowerCase() : ''
        if (!email) return
        const ip = ipFromHeaders(ctx.request?.headers ?? ctx.headers) ?? UNKNOWN_IP
        const keys = signInLimitKeys(email, ip)
        const retryAfter =
          (await consumeRateLimit(db, keys.perEmailAndIp, RATE_WINDOW_SEC, SIGN_INS_PER_EMAIL_AND_IP)) ??
          (await consumeRateLimit(db, keys.perEmail, RATE_WINDOW_SEC, SIGN_INS_PER_EMAIL))
        if (retryAfter !== null) {
          throw new APIError(
            'TOO_MANY_REQUESTS',
            { message: 'Too many sign-in attempts for this email.', code: 'TOO_MANY_SIGN_IN_ATTEMPTS' },
            { 'X-Retry-After': String(retryAfter) },
          )
        }
      }),
    },
  })
}

export type Auth = ReturnType<typeof createAuth>

let defaultAuth: Auth | undefined

/** The production instance, built on first use from the environment. */
export function getDefaultAuth(db?: Db): Auth {
  defaultAuth ??= createAuth({ db: db ?? createDb().db })
  return defaultAuth
}
