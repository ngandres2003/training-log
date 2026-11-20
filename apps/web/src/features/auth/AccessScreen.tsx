import { useEffect, useState } from 'react'
import type { LastKnownUser } from '../../data/db'
import { getLastKnownUser } from '../../data/syncMeta'
import { authApi, rememberUser, type AuthApi } from './auth-client'
import { useOnline } from './hooks'
import { PasswordForm } from './PasswordForm'

export interface AccessScreenProps {
  onSignedIn: (user: LastKnownUser) => void
  api?: AuthApi
}

/**
 * VA · Acceso: email + password. Accounts are created only from an invite link
 * (`/invitacion/<token>`); a forgotten password is a new link from whoever invited you.
 */
export function AccessScreen({ onSignedIn, api = authApi }: AccessScreenProps) {
  const online = useOnline()
  const [hasKnownUser, setHasKnownUser] = useState(false)

  useEffect(() => {
    let alive = true
    void getLastKnownUser().then((u) => alive && setHasKnownUser(u !== null))
    return () => {
      alive = false
    }
  }, [])

  async function signedIn(user: LastKnownUser) {
    await rememberUser(user)
    onSignedIn(user)
  }

  const offlineText = hasKnownUser
    ? 'Sin conexión. Conéctate para entrar.'
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

      <PasswordForm api={api} onSignedIn={signedIn} />
      <p className="text-sm text-polvo">¿Aún no tienes cuenta? Se entra con una invitación.</p>
    </main>
  )
}
