import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { LastKnownUser } from '../../data/db'
import type { AuthApi, VerifyResult } from './auth-client'
import { formatClock, useCountdown, useOnline } from './hooks'

/** Seconds before "Reenviar código" is offered again. */
export const RESEND_AFTER_SEC = 60

type CodeError = Exclude<VerifyResult, { ok: true }>['reason'] | 'send-failed'

const ERROR_TEXT: Record<Exclude<CodeError, 'rate-limited'>, string> = {
  invalid: 'Código incorrecto. Revísalo e inténtalo de nuevo.',
  expired: 'El código ha caducado. Pide uno nuevo.',
  'too-many-attempts': 'Demasiados intentos con este código. Pide uno nuevo.',
  offline: 'Sin conexión. Conéctate para continuar.',
  error: 'Algo ha fallado. Inténtalo de nuevo.',
  'send-failed': 'No pudimos enviar el código. Inténtalo de nuevo.',
}

export interface CodeStepProps {
  email: string
  api: AuthApi
  onVerified: (user: LastKnownUser) => void | Promise<void>
  /** Omitted when the email is locked (re-auth sheet). */
  onChangeEmail?: () => void
  /** Send the first code on mount (re-auth starts here); otherwise the caller already sent it. */
  sendOnMount?: boolean
}

/** VA step 2: 6-digit code, resend with countdown, wrong/expired/too-many states. */
export function CodeStep({ email, api, onVerified, onChangeEmail, sendOnMount = false }: CodeStepProps) {
  const inputId = useId()
  const online = useOnline()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<CodeError | null>(null)
  const [resendIn, startResend] = useCountdown(sendOnMount ? 0 : RESEND_AFTER_SEC)
  const [waitIn, startWait] = useCountdown()
  const sentOnMount = useRef(false)

  async function send() {
    setError(null)
    const res = await api.sendCode(email)
    if (res.ok) {
      startResend(RESEND_AFTER_SEC)
      setCode('')
    } else if (res.reason === 'rate-limited') {
      startWait(res.retryAfterSec)
    } else {
      setError(res.reason === 'offline' ? 'offline' : 'send-failed')
    }
  }

  useEffect(() => {
    if (!sendOnMount || sentOnMount.current) return
    sentOnMount.current = true
    void send()
    // Once per mounted step; the ref also guards StrictMode's double effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (code.length !== 6 || busy) return
    setBusy(true)
    setError(null)
    const res = await api.verifyCode(email, code)
    if (res.ok) {
      await onVerified(res.user)
      return
    }
    setBusy(false)
    if (res.reason === 'rate-limited') startWait(res.retryAfterSec)
    else setError(res.reason)
  }

  const alert =
    waitIn > 0
      ? `Demasiados intentos. Podrás pedir otro código en ${formatClock(waitIn)}`
      : error && error !== 'rate-limited'
        ? ERROR_TEXT[error]
        : null

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-polvo">
        Te enviamos un código a <strong className="text-arena">{email}</strong>
      </p>
      <label htmlFor={inputId} className="text-sm text-polvo">
        Código de 6 dígitos
      </label>
      <input
        id={inputId}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        className="min-h-12 rounded-lg border border-concreto bg-asfalto px-4 text-center font-display text-3xl tracking-[0.4em] text-arena"
      />
      {alert && (
        <p role="alert" className="text-sm text-atardecer">
          {alert}
        </p>
      )}
      <button
        type="submit"
        disabled={code.length !== 6 || busy || !online}
        className="min-h-12 rounded-lg bg-sol font-bold text-tinta disabled:opacity-50"
      >
        {busy ? 'Comprobando…' : 'Entrar'}
      </button>
      <button
        type="button"
        onClick={() => void send()}
        disabled={resendIn > 0 || waitIn > 0 || !online}
        className="min-h-12 rounded-lg text-arena disabled:text-polvo"
      >
        {resendIn > 0 ? `Reenviar código (${formatClock(resendIn)})` : 'Reenviar código'}
      </button>
      {onChangeEmail && (
        <button type="button" onClick={onChangeEmail} className="min-h-12 rounded-lg text-polvo">
          Cambiar email
        </button>
      )}
    </form>
  )
}
