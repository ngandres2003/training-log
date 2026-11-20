import { useEffect, useId, useState } from 'react'
import type { LastKnownUser } from '../../data/db'
import { getLastKnownUser } from '../../data/syncMeta'
import { authApi, ensureSameUser, type AuthApi } from './auth-client'
import { PasswordForm } from './PasswordForm'

export interface ReauthSheetProps {
  /** Closes the sheet; the screen underneath stays usable and logging keeps working (R5). */
  onDismiss: () => void
  /**
   * Called after the password is accepted. `sameUser` is false when the session belongs to a
   * different account than the stored one: the caller must stop sync and sign out (U15).
   */
  onSignedIn: (user: LastKnownUser, sameUser: boolean) => void
  api?: AuthApi
}

/**
 * Re-auth after `authExpired` (U3 step 7): a non-blocking bottom sheet over the current
 * screen, asking for the password with the email locked to the last known user.
 */
export function ReauthSheet({ onDismiss, onSignedIn, api = authApi }: ReauthSheetProps) {
  const titleId = useId()
  const [known, setKnown] = useState<LastKnownUser | null>(null)

  useEffect(() => {
    let alive = true
    void getLastKnownUser().then((u) => alive && setKnown(u))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDismiss()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  async function verified(user: LastKnownUser) {
    onSignedIn(user, await ensureSameUser(user.id))
  }

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[480px] flex-col gap-4 rounded-t-2xl border-t border-borde-fuerte bg-asfalto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-arena"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id={titleId} className="font-display text-2xl uppercase">
          Vuelve a entrar
        </h2>
        <button type="button" onClick={onDismiss} className="min-h-12 min-w-12 rounded-lg px-3 text-polvo">
          Ahora no
        </button>
      </div>
      <p className="text-sm text-polvo">
        Tu sesión ha caducado. Tus entrenos siguen guardados en este móvil y se sincronizarán al entrar.
      </p>
      {known && <PasswordForm lockedEmail={known.email} api={api} onSignedIn={verified} />}
    </section>
  )
}
