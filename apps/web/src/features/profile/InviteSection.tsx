import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { useShell } from '../../app/shell'
import { Button } from '../../ui/Button'
import { useOnline } from '../auth/hooks'
import type { CreateInviteResult, InviteSummary } from './invites-api'
import { Section } from './Section'

const STATUS_TEXT: Record<InviteSummary['status'], string> = {
  pending: 'Pendiente',
  used: 'Usada',
  expired: 'Caducada',
  revoked: 'Revocada',
}

const CREATE_ERROR: Record<Exclude<CreateInviteResult, { ok: true }>['reason'], string> = {
  'invalid-email': 'Escribe un email válido.',
  forbidden: 'Tu cuenta no puede invitar.',
  'rate-limited': 'Demasiadas invitaciones seguidas. Prueba en unos minutos.',
  offline: 'Sin conexión. Conéctate para invitar.',
  error: 'No se pudo generar el enlace. Inténtalo de nuevo.',
}

const day = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * V12 · Invitar (admins only; the server checks `ADMIN_EMAILS` too). Generates a single-use,
 * 7-day sign-up link for an email (or a new-password link for an existing account), to copy or
 * share (WhatsApp…), and lists recent invites with a revoke action. Needs a connection.
 */
export function InviteSection() {
  const { invitesApi } = useShell()
  const online = useOnline()
  const emailId = useId()
  const [isAdmin, setIsAdmin] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState<{ email: string; url: string } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [invites, setInvites] = useState<InviteSummary[] | null>(null)

  const refresh = useCallback(async () => {
    setInvites(await invitesApi.list())
  }, [invitesApi])

  // Asked again whenever the connection comes back, until known.
  useEffect(() => {
    if (!online || isAdmin) return
    let alive = true
    void invitesApi.isAdmin().then((admin) => {
      if (!alive || !admin) return
      setIsAdmin(true)
      void refresh()
    })
    return () => {
      alive = false
    }
  }, [online, isAdmin, invitesApi, refresh])

  if (!isAdmin) return null

  async function create(e: FormEvent) {
    e.preventDefault()
    const normalized = email.trim().toLowerCase()
    if (!normalized || busy) return
    setBusy(true)
    setError(null)
    setMessage(null)
    const res = await invitesApi.create(normalized)
    setBusy(false)
    if (!res.ok) {
      setError(CREATE_ERROR[res.reason])
      return
    }
    setLink({ email: res.invite.email, url: res.url })
    setEmail('')
    void refresh()
  }

  async function copyLink() {
    if (!link) return
    setMessage((await copy(link.url)) ? 'Enlace copiado.' : 'No se pudo copiar. Mantén pulsado el enlace para copiarlo.')
  }

  async function shareLink() {
    if (!link) return
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Training Log', text: `Tu invitación a Training Log (${link.email}):`, url: link.url })
        return
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
      }
    }
    await copyLink()
  }

  async function revoke(id: string) {
    if (await invitesApi.revoke(id)) void refresh()
    else setError('No se pudo revocar. Inténtalo de nuevo.')
  }

  return (
    <Section title="Invitar">
      <p className="text-sm text-polvo">
        Genera un enlace para que alguien cree su cuenta, o para que ponga una contraseña nueva si la
        olvidó. Caduca en 7 días y sirve una sola vez.
      </p>
      {!online && (
        <p role="status" className="text-sm text-polvo">
          Sin conexión. Conéctate para invitar.
        </p>
      )}
      <form onSubmit={create} className="flex flex-col gap-2">
        <label htmlFor={emailId} className="text-sm text-polvo">
          Email de la persona
        </label>
        <input
          id={emailId}
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="persona@email.com"
          disabled={!online}
          className="min-h-12 rounded-lg border border-concreto bg-hierro px-4 text-arena placeholder:text-polvo disabled:opacity-50"
        />
        <Button type="submit" disabled={!online || busy || !email.trim()}>
          {busy ? 'Generando…' : 'Generar enlace'}
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-atardecer">
          {error}
        </p>
      )}

      {link && (
        <div className="flex flex-col gap-2 rounded-lg bg-hierro p-3">
          <p className="text-sm text-polvo">Enlace para {link.email}:</p>
          <p className="break-all font-mono text-sm" aria-label="Enlace de invitación">
            {link.url}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => void copyLink()}>
              Copiar enlace
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => void shareLink()}>
              Compartir
            </Button>
          </div>
          {message && (
            <p role="status" className="text-sm text-polvo">
              {message}
            </p>
          )}
        </div>
      )}

      {invites && invites.length > 0 && (
        <ul aria-label="Invitaciones" className="flex flex-col divide-y divide-concreto">
          {invites.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate">{inv.email}</p>
                <p className="text-xs text-polvo">
                  {STATUS_TEXT[inv.status]} · creada {day(inv.createdAt)} ·{' '}
                  {inv.status === 'used' && inv.usedAt ? `usada ${day(inv.usedAt)}` : `caduca ${day(inv.expiresAt)}`}
                </p>
              </div>
              {inv.status === 'pending' && (
                <Button
                  variant="ghost"
                  disabled={!online}
                  aria-label={`Revocar invitación de ${inv.email}`}
                  onClick={() => void revoke(inv.id)}
                >
                  Revocar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
