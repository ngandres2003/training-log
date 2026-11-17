import { useEffect, useId, useState, type FormEvent } from 'react'
import type { LastKnownUser } from '../../data/db'
import { getLastKnownUser } from '../../data/syncMeta'
import { authApi, rememberUser, type AuthApi } from './auth-client'
import { CodeStep } from './CodeStep'
import { formatClock, useCountdown, useOnline } from './hooks'

export interface AccessScreenProps {
  onSignedIn: (user: LastKnownUser) => void
  api?: AuthApi
}

/**
 * VA · Acceso: email → 6-digit code (R3). States: normal, sending, code entry, wrong or
 * expired code, too many attempts with a countdown, and offline on first open.
 */
export function AccessScreen({ onSignedIn, api = authApi }: AccessScreenProps) {
  const emailId = useId()
  const online = useOnline()
  const [hasKnownUser, setHasKnownUser] = useState(false)
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [sending, setSending] = useState(false)
  const [sendFailed, setSendFailed] = useState(false)
  const [waitIn, startWait] = useCountdown()

  useEffect(() => {
    let alive = true
    void getLastKnownUser().then((u) => alive && setHasKnownUser(u !== null))
    return () => {
      alive = false
    }
  }, [])

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    const normalized = email.trim().toLowerCase()
    if (!normalized || sending) return
    setSending(true)
    setSendFailed(false)
    const res = await api.sendCode(normalized)
    setSending(false)
    if (res.ok) {
      setEmail(normalized)
      setStep('code')
    } else if (res.reason === 'rate-limited') {
      startWait(res.retryAfterSec)
    } else {
      setSendFailed(true)
    }
  }

  async function verified(user: LastKnownUser) {
    await rememberUser(user)
    onSignedIn(user)
  }

  const offlineText = hasKnownUser
    ? 'Sin conexión. Conéctate para recibir el código.'
    : 'Necesitas conexión para entrar la primera vez'

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center gap-8 bg-hierro px-4 py-6 text-arena">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-5xl uppercase">Training Log</h1>
        <p className="text-polvo">Tus entrenos, en el móvil y sin depender de la cobertura.</p>
      </header>

      {!online && (
        <p role="status" className="rounded-lg bg-asfalto p-4 text-arena">
          {offlineText}
        </p>
      )}

      {step === 'email' ? (
        <form onSubmit={sendCode} className="flex flex-col gap-4">
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
          {waitIn > 0 && (
            <p role="alert" className="text-sm text-atardecer">
              Demasiados intentos. Podrás pedir otro código en {formatClock(waitIn)}
            </p>
          )}
          {sendFailed && waitIn === 0 && (
            <p role="alert" className="text-sm text-atardecer">
              No pudimos enviar el código. Inténtalo de nuevo.
            </p>
          )}
          <button
            type="submit"
            disabled={!online || sending || waitIn > 0}
            className="min-h-12 rounded-lg bg-sol font-bold text-hierro disabled:opacity-50"
          >
            {sending ? 'Enviando…' : 'Enviar código'}
          </button>
        </form>
      ) : (
        <CodeStep email={email} api={api} onVerified={verified} onChangeEmail={() => setStep('email')} />
      )}
    </main>
  )
}
