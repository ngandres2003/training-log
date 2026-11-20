import { createAuthClient } from 'better-auth/react'
import type { LastKnownUser } from '../../data/db'
import { getLastKnownUser, setLastKnownUser } from '../../data/syncMeta'

/** Better Auth client. No baseURL: it resolves to `/api/auth` on the page's own origin (KTD1). */
export const authClient = createAuthClient()

/** Same rule as the server. */
export const MIN_PASSWORD_LENGTH = 8

type Failure<R extends string> = { ok: false; reason: R } | { ok: false; reason: 'rate-limited'; retryAfterSec: number }

export type SignInResult = { ok: true; user: LastKnownUser } | Failure<'invalid' | 'offline' | 'error'>

export type InviteStatus = 'pending' | 'used' | 'expired' | 'revoked'

export type InviteCheck =
  | { ok: true; email: string; status: InviteStatus; hasAccount: boolean }
  | Failure<'invalid' | 'offline' | 'error'>

export type RedeemResult =
  | { ok: true; user: LastKnownUser }
  | Failure<'invalid' | 'used' | 'expired' | 'revoked' | 'weak-password' | 'offline' | 'error'>

/** What VA and the invitation page need from the server; injectable so screens are tested without a network. */
export interface AuthApi {
  signIn(email: string, password: string): Promise<SignInResult>
  checkInvite(token: string): Promise<InviteCheck>
  redeemInvite(token: string, password: string): Promise<RedeemResult>
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

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const REDEEM_ERRORS: Record<string, 'invalid' | 'used' | 'expired' | 'revoked' | 'weak-password'> = {
  invite_invalid: 'invalid',
  invite_used: 'used',
  invite_expired: 'expired',
  invite_revoked: 'revoked',
  invalid_password: 'weak-password',
}

export const authApi: AuthApi = {
  async signIn(email, password) {
    let response: Response | undefined
    try {
      const { data, error } = await authClient.signIn.email({
        email,
        password,
        fetchOptions: { onError: (ctx: { response: Response }) => void (response = ctx.response) },
      })
      if (data) return { ok: true, user: { id: data.user.id, email: data.user.email } }
      const { status } = (error ?? {}) as ClientError
      if (status === 429) return { ok: false, reason: 'rate-limited', retryAfterSec: retryAfterOf(response) }
      if (status === 401) return { ok: false, reason: 'invalid' }
      return failure()
    } catch {
      return failure()
    }
  },

  async checkInvite(token) {
    try {
      const res = await postJson('/api/invites/check', { token })
      if (res.status === 429) return { ok: false, reason: 'rate-limited', retryAfterSec: retryAfterOf(res) }
      if (res.status === 404) return { ok: false, reason: 'invalid' }
      if (!res.ok) return failure()
      const body = (await res.json()) as { email: string; status: InviteStatus; hasAccount: boolean }
      return { ok: true, ...body }
    } catch {
      return failure()
    }
  },

  async redeemInvite(token, password) {
    try {
      const res = await postJson('/api/invites/redeem', { token, password })
      if (res.status === 429) return { ok: false, reason: 'rate-limited', retryAfterSec: retryAfterOf(res) }
      const body = (await res.json().catch(() => ({}))) as { error?: string; user?: LastKnownUser }
      if (res.ok && body.user) return { ok: true, user: { id: body.user.id, email: body.user.email } }
      const reason = body.error ? REDEEM_ERRORS[body.error] : undefined
      return reason ? { ok: false, reason } : failure()
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
