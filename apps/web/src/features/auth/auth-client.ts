import { emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import type { LastKnownUser } from '../../data/db'
import { getLastKnownUser, setLastKnownUser } from '../../data/syncMeta'

/** Better Auth client. No baseURL: it resolves to `/api/auth` on the page's own origin (KTD1). */
export const authClient = createAuthClient({ plugins: [emailOTPClient()] })

export type SendResult =
  | { ok: true }
  | { ok: false; reason: 'rate-limited'; retryAfterSec: number }
  | { ok: false; reason: 'offline' | 'error' }

export type VerifyResult =
  | { ok: true; user: LastKnownUser }
  | { ok: false; reason: 'rate-limited'; retryAfterSec: number }
  | { ok: false; reason: 'invalid' | 'expired' | 'too-many-attempts' | 'offline' | 'error' }

/** What VA needs from the server; injectable so screens are tested without a network. */
export interface AuthApi {
  sendCode(email: string): Promise<SendResult>
  verifyCode(email: string, code: string): Promise<VerifyResult>
}

interface ClientError {
  status?: number
  code?: string
}

function retryAfterOf(res: Response | undefined): number {
  const n = Number(res?.headers.get('X-Retry-After'))
  return Number.isFinite(n) && n > 0 ? n : 60
}

function failure(): { ok: false; reason: 'offline' | 'error' } {
  return { ok: false, reason: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error' }
}

export const authApi: AuthApi = {
  async sendCode(email) {
    let response: Response | undefined
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
        fetchOptions: { onError: (ctx: { response: Response }) => void (response = ctx.response) },
      })
      if (!error) return { ok: true }
      if ((error as ClientError).status === 429) {
        return { ok: false, reason: 'rate-limited', retryAfterSec: retryAfterOf(response) }
      }
      return failure()
    } catch {
      return failure()
    }
  },

  async verifyCode(email, code) {
    let response: Response | undefined
    try {
      const { data, error } = await authClient.signIn.emailOtp({
        email,
        otp: code,
        fetchOptions: { onError: (ctx: { response: Response }) => void (response = ctx.response) },
      })
      if (data) return { ok: true, user: { id: data.user.id, email: data.user.email } }
      const { status, code: errorCode } = (error ?? {}) as ClientError
      if (status === 429) return { ok: false, reason: 'rate-limited', retryAfterSec: retryAfterOf(response) }
      if (errorCode === 'INVALID_OTP') return { ok: false, reason: 'invalid' }
      if (errorCode === 'OTP_EXPIRED') return { ok: false, reason: 'expired' }
      if (errorCode === 'TOO_MANY_ATTEMPTS') return { ok: false, reason: 'too-many-attempts' }
      return failure()
    } catch {
      return failure()
    }
  },
}

/**
 * Whether a verified session belongs to the stored last known user. False when no user is
 * stored. Sync (U7) and the app shell (U10) stop and sign out when this is false.
 */
export async function ensureSameUser(sessionUserId: string): Promise<boolean> {
  const known = await getLastKnownUser()
  return known !== null && known.id === sessionUserId
}

/** Records a first sign-in (or one after sign-out) as the device's user (used offline by U10). */
export function rememberUser(user: LastKnownUser): Promise<void> {
  return setLastKnownUser(user)
}
