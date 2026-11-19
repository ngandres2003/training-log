import { useEffect, useState, type ReactNode } from 'react'
import type { Settings } from '@training-log/domain'
import type { LastKnownUser } from '../data/db'
import { getSettings } from '../data/repositories/settings'
import { requestPersistentStorage } from '../data/storage'
import { getLastKnownUser } from '../data/syncMeta'
import { AccessScreen } from '../features/auth/AccessScreen'
import { Onboarding } from '../features/onboarding/Onboarding'
import { useShell } from './shell'

type Phase =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'preparing'; user: LastKnownUser }
  | { kind: 'onboarding'; user: LastKnownUser; settings: Settings | undefined }
  | { kind: 'ready'; user: LastKnownUser }

async function phaseFor(user: LastKnownUser): Promise<Phase> {
  const settings = await getSettings()
  return settings?.onboardedAt ? { kind: 'ready', user } : { kind: 'onboarding', user, settings }
}

/**
 * Decides what the app opens to (R3, R5):
 * - a last known user in Dexie opens the app without contacting the server (works offline);
 * - no stored user shows VA; after a first sign-in, one sync cycle runs so an existing
 *   account's settings arrive before deciding on onboarding;
 * - V0 runs until the user's settings have `onboardedAt`.
 * Sync triggers start once the user is known.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { engine, authApi, startSync } = useShell()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const userId = phase.kind === 'loading' || phase.kind === 'signed-out' ? null : phase.user.id

  useEffect(() => {
    let alive = true
    void getLastKnownUser().then(async (user) => {
      const next = user ? await phaseFor(user) : ({ kind: 'signed-out' } as const)
      if (alive) setPhase(next)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    return startSync(engine)
  }, [userId, engine, startSync])

  async function signedIn(user: LastKnownUser) {
    setPhase({ kind: 'preparing', user })
    void requestPersistentStorage()
    // Whatever the cycle's outcome, the app opens; sync keeps retrying on its own.
    await engine.sync().catch(() => undefined)
    setPhase(await phaseFor(user))
  }

  switch (phase.kind) {
    case 'loading':
      return <Splash text="Cargando" />
    case 'signed-out':
      return <AccessScreen api={authApi} onSignedIn={(u) => void signedIn(u)} />
    case 'preparing':
      return <Splash text="Preparando tu cuenta…" />
    case 'onboarding':
      return <Onboarding initial={phase.settings} onDone={() => setPhase({ kind: 'ready', user: phase.user })} />
    case 'ready':
      return children
  }
}

function Splash({ text }: { text: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] items-center justify-center bg-hierro px-4 text-polvo">
      <p role="status">{text}</p>
    </main>
  )
}
