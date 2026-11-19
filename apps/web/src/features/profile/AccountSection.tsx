import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useSyncSnapshot } from '../../app/SyncIndicator'
import { useShell } from '../../app/shell'
import { db } from '../../data/db'
import { getSettings } from '../../data/repositories/settings'
import { getLastKnownUser } from '../../data/syncMeta'
import { Button } from '../../ui/Button'
import { Section } from './Section'

const changes = (n: number) => `${n} ${n === 1 ? 'cambio' : 'cambios'}`

type Step = 'idle' | 'pending' | 'confirm-lose'

/**
 * V12 Cuenta: name, email and sign-out (U15 step 2). With pending changes it offers
 * "Sincronizar y salir" (disabled offline or with an expired session) and
 * "Salir y perder N cambios" behind a second confirmation.
 */
export function AccountSection({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const { engine } = useShell()
  const snap = useSyncSnapshot()
  const user = useLiveQuery(getLastKnownUser, [], null)
  const name = useLiveQuery(async () => (await getSettings())?.displayName ?? '', [], '')
  const pending = useLiveQuery(() => db.outbox.count(), [], 0)
  const [step, setStep] = useState<Step>('idle')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const canSync = snap.status !== 'offline' && snap.status !== 'authExpired'

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  function requestSignOut() {
    setMessage(null)
    if (pending === 0) void run(onSignOut)
    else setStep('pending')
  }

  async function syncAndSignOut() {
    const result = await engine.sync()
    if (result === 'ok' && (await db.outbox.count()) === 0) {
      await onSignOut()
      return
    }
    setMessage('No se pudo subir todo. Inténtalo de nuevo cuando haya conexión.')
  }

  return (
    <Section title="Cuenta">
      <div>
        {name && <p className="font-bold">{name}</p>}
        <p className="text-polvo">{user?.email}</p>
      </div>

      {step === 'idle' && (
        <Button variant="secondary" disabled={busy} onClick={requestSignOut}>
          Cerrar sesión
        </Button>
      )}

      {step === 'pending' && (
        <div className="flex flex-col gap-2">
          <p>Tienes {changes(pending)} sin subir.</p>
          <Button disabled={!canSync || busy} onClick={() => void run(syncAndSignOut)}>
            Sincronizar y salir
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setStep('confirm-lose')}>
            Salir y perder {changes(pending)}
          </Button>
          <Button variant="ghost" onClick={() => setStep('idle')}>
            Cancelar
          </Button>
        </div>
      )}

      {step === 'confirm-lose' && (
        <div role="alertdialog" aria-label="Confirmar salida" className="flex flex-col gap-2">
          <p className="font-bold">
            Se borrarán {changes(pending)} que no se han subido. No se pueden recuperar.
          </p>
          <Button variant="secondary" disabled={busy} onClick={() => void run(onSignOut)}>
            Sí, perder {changes(pending)} y salir
          </Button>
          <Button variant="ghost" onClick={() => setStep('pending')}>
            Cancelar
          </Button>
        </div>
      )}

      {message && (
        <p role="status" className="text-sm text-polvo">
          {message}
        </p>
      )}
    </Section>
  )
}
