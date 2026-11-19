import { useState } from 'react'
import { Outlet } from 'react-router'
import type { LastKnownUser } from '../data/db'
import { useOnline } from '../features/auth/hooks'
import { ReauthSheet } from '../features/auth/ReauthSheet'
import { Button } from '../ui/Button'
import { useActiveWorkoutUi } from './active-workout-slot'
import { useShell } from './shell'
import { useSyncSnapshot } from './SyncIndicator'
import { indicatorState } from '../data/sync/status'
import { TabBar } from './TabBar'
import { UpdateToast } from './UpdateToast'

/**
 * Signed-in shell: tab page, then a bottom stack (toasts, mini-player, tab bar) that sticks to
 * the bottom of one centered mobile column (KTD16), plus the global layers.
 */
export function AppLayout() {
  const { engine, authApi, onSignOutRequested } = useShell()
  const { showReauthBanner } = indicatorState(useSyncSnapshot())
  const online = useOnline()
  const activeWorkout = useActiveWorkoutUi()
  const [reauthOpen, setReauthOpen] = useState(false)
  const [otherAccount, setOtherAccount] = useState(false)

  function reauthenticated(_user: LastKnownUser, sameUser: boolean) {
    setReauthOpen(false)
    if (sameUser) void engine.resume()
    else setOtherAccount(true)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-hierro text-arena">
      {/* Spec VA: ask to reconnect only once the connection is back, without blocking. */}
      {showReauthBanner && online && (
        <section
          aria-label="Sesión caducada"
          className="flex items-center justify-between gap-3 border-b border-sol/40 bg-asfalto py-1 pr-1 pl-4 text-sm"
        >
          <p>Tu sesión ha caducado. Tus entrenos siguen guardados aquí.</p>
          <Button variant="ghost" className="shrink-0 text-sol" onClick={() => setReauthOpen(true)}>
            Volver a entrar
          </Button>
        </section>
      )}

      <main className="flex flex-1 flex-col px-4 pb-4">
        <Outlet />
      </main>

      <div className="sticky bottom-0 z-30 flex flex-col gap-2">
        <div className="flex flex-col gap-2 px-2 empty:hidden">
          <UpdateToast />
        </div>
        {activeWorkout && <activeWorkout.MiniPlayer />}
        <TabBar />
      </div>

      {activeWorkout && <activeWorkout.Layer />}

      {reauthOpen && (
        <ReauthSheet api={authApi} onDismiss={() => setReauthOpen(false)} onSignedIn={reauthenticated} />
      )}

      {otherAccount && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-hierro/80 sm:items-center">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="other-account-title"
            aria-describedby="other-account-text"
            className="flex w-full max-w-[480px] flex-col gap-4 rounded-t-2xl bg-asfalto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <h2 id="other-account-title" className="font-display text-2xl uppercase">
              Otra cuenta
            </h2>
            <p id="other-account-text" className="text-polvo">
              Has entrado con otra cuenta. Los datos de este móvil pertenecen a la cuenta anterior y no se
              sincronizarán con esta. Cierra sesión para cambiar de cuenta.
            </p>
            {/* TODO(U15): the sign-out flow; the shell only forwards the request. */}
            <Button onClick={onSignOutRequested}>Cerrar sesión</Button>
          </section>
        </div>
      )}
    </div>
  )
}
