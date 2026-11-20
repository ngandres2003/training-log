import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useShell } from '../../app/shell'
import type { LastKnownUser } from '../../data/db'
import { getLastKnownUser } from '../../data/syncMeta'
import { MIN_PASSWORD_LENGTH, rememberUser, type InviteCheck, type RedeemResult } from './auth-client'
import { formatClock, useCountdown, useOnline } from './hooks'

/** Navigation state that tells the auth gate a sign-in just happened (run one sync first). */
export interface FreshSignInState {
  freshSignIn: true
}

type Loaded =
  | { kind: 'loading' }
  | { kind: 'failed'; text: string }
  | { kind: 'other-account'; known: LastKnownUser; email: string }
  | { kind: 'form'; email: string; hasAccount: boolean }

const LINK_TEXT = {
  invalid: 'Este enlace no es válido. Revisa que lo hayas copiado entero o pide uno nuevo.',
  used: 'Este enlace ya se ha usado. Si necesitas otra contraseña, pide un enlace nuevo a quien te invitó.',
  expired: 'Este enlace ha caducado. Pide uno nuevo a quien te invitó.',
  revoked: 'Este enlace ya no es válido: se ha generado uno más nuevo. Usa el último que te enviaron.',
} as const

const FAILURE_TEXT = {
  ...LINK_TEXT,
  'weak-password': `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  offline: 'Sin conexión. Conéctate para continuar.',
  error: 'Algo ha fallado. Inténtalo de nuevo.',
} as const

function textForCheck(res: Exclude<InviteCheck, { ok: true }>): string {
  if (res.reason === 'rate-limited') return `Demasiados intentos. Vuelve a probar en ${formatClock(res.retryAfterSec)}`
  return FAILURE_TEXT[res.reason]
}

/**
 * `/invitacion/:token`, outside the auth gate so it works on a fresh device. The person sets a
 * password (twice, at least 8 characters): a new account is created, or, for an existing account
 * (a "forgot password" link), the password is replaced on the same account. Then they are signed in.
 */
export function InvitationPage() {
  const { token = '' } = useParams()
  const { authApi, engine } = useShell()
  const navigate = useNavigate()
  const online = useOnline()
  const passwordId = useId()
  const confirmId = useId()
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [waitIn, startWait] = useCountdown()

  useEffect(() => {
    let alive = true
    void (async () => {
      const [res, known] = await Promise.all([authApi.checkInvite(token), getLastKnownUser()])
      if (!alive) return
      if (!res.ok) setLoaded({ kind: 'failed', text: textForCheck(res) })
      else if (res.status !== 'pending') setLoaded({ kind: 'failed', text: LINK_TEXT[res.status] })
      // A device holds one account's data; using another account's link here would mix them.
      else if (known && known.email !== res.email) setLoaded({ kind: 'other-account', known, email: res.email })
      else setLoaded({ kind: 'form', email: res.email, hasAccount: res.hasAccount })
    })()
    return () => {
      alive = false
    }
  }, [authApi, token])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(FAILURE_TEXT['weak-password'])
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setBusy(true)
    setError(null)
    const res: RedeemResult = await authApi.redeemInvite(token, password)
    if (!res.ok) {
      setBusy(false)
      if (res.reason === 'rate-limited') startWait(res.retryAfterSec)
      else setError(FAILURE_TEXT[res.reason])
      return
    }
    const known = await getLastKnownUser()
    if (known?.id === res.user.id) {
      // Same account on this device (new password): sync was stopped by the old session.
      void engine.resume()
      navigate('/', { replace: true })
      return
    }
    await rememberUser(res.user)
    navigate('/', { replace: true, state: { freshSignIn: true } satisfies FreshSignInState })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center gap-8 bg-hierro px-4 py-6 text-arena">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-5xl uppercase">Training Log</h1>
        <p className="text-polvo">Invitación</p>
      </header>

      {loaded.kind === 'loading' && <p role="status">Comprobando el enlace…</p>}

      {loaded.kind === 'failed' && (
        <div className="flex flex-col gap-4">
          <p role="alert" className="text-atardecer">
            {loaded.text}
          </p>
          <Link to="/" className="flex min-h-12 items-center justify-center rounded-lg text-arena">
            Ir a la app
          </Link>
        </div>
      )}

      {loaded.kind === 'other-account' && (
        <div className="flex flex-col gap-4">
          <p role="alert" className="text-atardecer">
            Este móvil tiene abierta la cuenta {loaded.known.email}. Para usar la invitación de{' '}
            {loaded.email}, cierra antes la sesión en Perfil y vuelve a abrir el enlace.
          </p>
          <Link to="/perfil" className="flex min-h-12 items-center justify-center rounded-lg text-arena">
            Ir a Perfil
          </Link>
        </div>
      )}

      {loaded.kind === 'form' && (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <p className="text-polvo">
            {loaded.hasAccount ? 'Crea una contraseña nueva para ' : 'Crea tu contraseña para '}
            <strong className="text-arena">{loaded.email}</strong>
            {loaded.hasAccount ? '. Tus datos se mantienen.' : '.'}
          </p>
          <label htmlFor={passwordId} className="text-sm text-polvo">
            Contraseña
          </label>
          <input
            id={passwordId}
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={`${passwordId}-hint`}
            className="min-h-12 rounded-lg border border-concreto bg-asfalto px-4 text-arena"
          />
          <p id={`${passwordId}-hint`} className="-mt-2 text-sm text-polvo">
            Al menos {MIN_PASSWORD_LENGTH} caracteres.
          </p>
          <label htmlFor={confirmId} className="text-sm text-polvo">
            Repite la contraseña
          </label>
          <input
            id={confirmId}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="min-h-12 rounded-lg border border-concreto bg-asfalto px-4 text-arena"
          />
          {(error || waitIn > 0) && (
            <p role="alert" className="text-sm text-atardecer">
              {waitIn > 0 ? `Demasiados intentos. Vuelve a probar en ${formatClock(waitIn)}` : error}
            </p>
          )}
          <button
            type="submit"
            disabled={!online || busy || waitIn > 0 || !password || !confirm}
            className="min-h-12 rounded-lg bg-sol font-bold text-tinta disabled:opacity-50"
          >
            {busy ? 'Guardando…' : loaded.hasAccount ? 'Guardar contraseña y entrar' : 'Crear cuenta y entrar'}
          </button>
        </form>
      )}

      {!online && loaded.kind !== 'loading' && (
        <p role="status" className="rounded-lg bg-asfalto p-4 text-arena">
          Necesitas conexión para usar la invitación.
        </p>
      )}
    </main>
  )
}
