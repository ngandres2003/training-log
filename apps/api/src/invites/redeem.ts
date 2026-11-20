import type { Auth } from '../auth/auth.js'
import type { Db } from '../db/client.js'
import { claimInvite, findByToken, recordInviteUser, releaseInvite, statusOf, type InviteStatus } from './invites.js'

export type RedeemFailure = 'invite_invalid' | 'invite_used' | 'invite_expired' | 'invite_revoked'

export type RedeemResult =
  | { ok: true; userId: string; email: string; created: boolean }
  | { ok: false; error: RedeemFailure }

const FAILURE: Record<Exclude<InviteStatus, 'pending'>, RedeemFailure> = {
  used: 'invite_used',
  expired: 'invite_expired',
  revoked: 'invite_revoked',
}

/**
 * Redeems an invite token with a new password (the caller checks the password length).
 *
 * - No account for the invite's email: creates the user and its credential account.
 * - An existing account (the "forgot password" link): sets the new password on the same user,
 *   so its id and data are kept, and ends its existing sessions.
 *
 * The invite is claimed first, atomically, so a token works once; if the account step fails the
 * claim is released and the link can be retried. The caller then signs in with the password.
 */
export async function redeemInvite(auth: Auth, db: Db, token: string, password: string): Promise<RedeemResult> {
  const invite = await claimInvite(db, token)
  if (!invite) {
    const row = await findByToken(db, token)
    if (!row) return { ok: false, error: 'invite_invalid' }
    const status = statusOf(row)
    // A row that is still pending here lost a race with a concurrent redeem.
    return { ok: false, error: status === 'pending' ? 'invite_used' : FAILURE[status] }
  }

  try {
    const ctx = await auth.$context
    const adapter = ctx.internalAdapter
    const hash = await ctx.password.hash(password)
    const existing = await adapter.findUserByEmail(invite.email, { includeAccounts: true })
    let userId: string
    if (existing) {
      userId = existing.user.id
      const credential = existing.accounts.find((a) => a.providerId === 'credential' && a.accountId === userId)
      if (credential) await adapter.updatePassword(userId, hash)
      else await adapter.linkAccount({ userId, providerId: 'credential', accountId: userId, password: hash })
      // Sessions opened with the old password end; devices re-enter with the new one.
      await adapter.deleteUserSessions(userId)
    } else {
      const created = await adapter.createUser(
        { email: invite.email, name: '', emailVerified: true },
        { method: 'email-password' },
      )
      userId = created.id
      await adapter.linkAccount({ userId, providerId: 'credential', accountId: userId, password: hash })
    }
    await recordInviteUser(db, invite.id, userId)
    return { ok: true, userId, email: invite.email, created: !existing }
  } catch (err) {
    await releaseInvite(db, invite.id).catch(() => undefined)
    throw err
  }
}
