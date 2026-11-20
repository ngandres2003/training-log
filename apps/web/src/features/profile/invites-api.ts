import type { InviteStatus } from '../auth/auth-client'

export interface InviteSummary {
  id: string
  email: string
  createdAt: string
  expiresAt: string
  usedAt: string | null
  status: InviteStatus
}

export type CreateInviteResult =
  | { ok: true; invite: InviteSummary; url: string }
  | { ok: false; reason: 'invalid-email' | 'forbidden' | 'rate-limited' | 'offline' | 'error' }

/** The admin side of invites (Perfil · Invitar); injectable so the section is tested without a network. */
export interface InvitesApi {
  /** Whether the signed-in account is an admin (`ADMIN_EMAILS` on the server). False when unknown. */
  isAdmin(): Promise<boolean>
  create(email: string): Promise<CreateInviteResult>
  /** Null when the list could not be loaded. */
  list(): Promise<InviteSummary[] | null>
  revoke(id: string): Promise<boolean>
}

function offlineOr<T extends string>(reason: T): T | 'offline' {
  return typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : reason
}

export const invitesApi: InvitesApi = {
  async isAdmin() {
    try {
      const res = await fetch('/api/me', { credentials: 'same-origin' })
      if (!res.ok) return false
      return ((await res.json()) as { isAdmin?: boolean }).isAdmin === true
    } catch {
      return false
    }
  },

  async create(email) {
    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.status === 400) return { ok: false, reason: 'invalid-email' }
      if (res.status === 401 || res.status === 403) return { ok: false, reason: 'forbidden' }
      if (res.status === 429) return { ok: false, reason: 'rate-limited' }
      if (!res.ok) return { ok: false, reason: 'error' }
      const body = (await res.json()) as { invite: InviteSummary; path: string }
      return { ok: true, invite: body.invite, url: `${window.location.origin}${body.path}` }
    } catch {
      return { ok: false, reason: offlineOr('error') }
    }
  },

  async list() {
    try {
      const res = await fetch('/api/invites', { credentials: 'same-origin' })
      if (!res.ok) return null
      return ((await res.json()) as { invites: InviteSummary[] }).invites
    } catch {
      return null
    }
  },

  async revoke(id) {
    try {
      const res = await fetch(`/api/invites/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      return res.ok
    } catch {
      return false
    }
  },
}
