import { useId, useState, type FormEvent } from 'react'
import type { LastKnownUser } from '../../data/db'
import type { AuthApi, SignInResult } from './auth-client'
import { formatClock, useCountdown, useOnline } from './hooks'

export const FORGOT_PASSWORD_TEXT = '¿Olvidaste tu contraseña? Pide un enlace nuevo a quien te invitó.'

type SignInError = Exclude<Exclude<SignInResult, { ok: true }>['reason'], 'rate-limited'>

const ERROR_TEXT: Record<SignInError, string> = {
  invalid: 'Email o contraseña incorrectos.',
  offline: 'Sin conexión. Conéctate para continuar.',
  error: 'Algo ha fallado. Inténtalo de nuevo.',
}

export interface PasswordFormProps {
  api: AuthApi
  onSignedIn: (user: LastKnownUser) => void | Promise<void>
  /** Locks the email (re-auth sheet); otherwise the user types it. */
  lockedEmail?: string
}

/** Email + password sign-in (VA and the re-auth sheet). Accounts only come from invite links. */
export function PasswordForm({ api, onSignedIn, lockedEmail }: PasswordFormProps) {
  const emailId = useId()
  const passwordId = useId()
  const online = useOnline()
  const [email, setEmail] = useState(lockedEmail ?? '')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<SignInError | null>(null)
  const [waitIn, startWait] = useCountdown()

  async function submit(e: FormEvent) {
    e.preventDefault()
    const normalized = (lockedEmail ?? email).trim().toLowerCase()
    if (!normalized || !password || busy) return
    setBusy(true)
    setError(null)
    const res = await api.signIn(normalized, password)
    if (res.ok) {
      await onSignedIn(res.user)
      return
    }
    setBusy(false)
    if (res.reason === 'rate-limited') startWait(res.retryAfterSec)
    else setError(res.reason)
  }

  const alert =
    waitIn > 0
      ? `Demasiados intentos. Vuelve a probar en ${formatClock(waitIn)}`
      : error
        ? ERROR_TEXT[error]
        : null

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {lockedEmail ? (
        <p className="text-polvo">
          Entra como <strong className="text-arena">{lockedEmail}</strong>
        </p>
      ) : (
        <>
          <label htmlFor={emailId} className="text-sm text-polvo">
            Email
          </label>
          <input
            id={emailId}
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="min-h-12 rounded-lg border border-concreto bg-asfalto px-4 text-arena placeholder:text-polvo"
          />
        </>
      )}
      <label htmlFor={passwordId} className="text-sm text-polvo">
        Contraseña
      </label>
      <input
        id={passwordId}
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="min-h-12 rounded-lg border border-concreto bg-asfalto px-4 text-arena"
      />
      {alert && (
        <p role="alert" className="text-sm text-atardecer">
          {alert}
        </p>
      )}
      <button
        type="submit"
        disabled={!online || busy || waitIn > 0 || !password}
        className="min-h-12 rounded-lg bg-sol font-bold text-tinta disabled:opacity-50"
      >
        {busy ? 'Entrando…' : 'Entrar'}
      </button>
      <p className="text-sm text-polvo">{FORGOT_PASSWORD_TEXT}</p>
    </form>
  )
}
