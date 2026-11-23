import { useEffect, useState, useSyncExternalStore } from 'react'
import { requestNotificationPermission } from '../../pwa/notify'
import { disablePush, ensurePushSubscription, pushState, subscribePushState, type PushState } from '../../pwa/push'
import { Button } from '../../ui/Button'
import { Section } from './Section'

const TEXT: Record<PushState, string> = {
  on: 'Activadas en este dispositivo. Te avisamos al terminar el descanso, aunque la pantalla esté apagada.',
  off: 'Desactivadas en este dispositivo.',
  default: 'Te avisamos al terminar el descanso, aunque la pantalla esté apagada.',
  denied: 'Bloqueadas. Actívalas en los ajustes del navegador o del teléfono para esta app.',
  unsupported: 'Este navegador no permite notificaciones. En iPhone, instala la app en la pantalla de inicio primero.',
  unconfigured: 'El servidor todavía no tiene las notificaciones configuradas.',
}

/** V12 · Notificaciones: rest-end Web Push for this device. */
export function NotificationsSection() {
  const state = useSyncExternalStore(subscribePushState, pushState)
  const [busy, setBusy] = useState(false)

  // Reflect the real state (permission may have changed in the system settings).
  useEffect(() => {
    void ensurePushSubscription()
  }, [])

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }

  const enable = () =>
    run(async () => {
      await requestNotificationPermission()
      // Subscribes when granted; otherwise just updates the state to denied/default.
      await ensurePushSubscription({ optIn: true })
    })

  return (
    <Section title="Notificaciones">
      <p role="status" className="text-polvo">
        {TEXT[state]}
      </p>
      {(state === 'default' || state === 'off') && (
        <Button variant="secondary" disabled={busy} onClick={() => void enable()}>
          Activar notificaciones
        </Button>
      )}
      {state === 'on' && (
        <Button variant="secondary" disabled={busy} onClick={() => void run(disablePush)}>
          Desactivar en este dispositivo
        </Button>
      )}
    </Section>
  )
}
