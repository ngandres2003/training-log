import type { LastKnownUser } from '../../data/db'
import type { AuthApi, SignInResult } from './auth-client'

export const ANA: LastKnownUser = { id: 'user-ana', email: 'ana@example.com' }

/** An AuthApi without network: sign-in succeeds as `user`, invites are invalid unless overridden. */
export function fakeAuthApi(
  user: LastKnownUser = ANA,
  over: Partial<AuthApi> = {},
): AuthApi & { attempts: [string, string][] } {
  const attempts: [string, string][] = []
  return {
    attempts,
    async signIn(email, password): Promise<SignInResult> {
      attempts.push([email, password])
      return { ok: true, user }
    },
    checkInvite: async () => ({ ok: false, reason: 'invalid' }),
    redeemInvite: async () => ({ ok: false, reason: 'invalid' }),
    ...over,
  }
}
