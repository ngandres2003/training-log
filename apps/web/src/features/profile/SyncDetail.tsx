import type { SyncTable } from '@training-log/domain'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useSyncSnapshot } from '../../app/SyncIndicator'
import { useShell } from '../../app/shell'
import { db, type SyncErrorEntry } from '../../data/db'
import type { SyncSnapshot } from '../../data/sync/status'
import { Button } from '../../ui/Button'
import { Section } from './Section'

const TABLE_LABEL: Record<SyncTable, string> = {
  settings: 'Ajustes',
  folders: 'Carpeta',
  routines: 'Rutina',
  routineExercises: 'Ejercicio de rutina',
  routineSets: 'Serie de rutina',
  workouts: 'Sesión',
  workoutExercises: 'Ejercicio de sesión',
  workoutSets: 'Serie',
  customExercises: 'Ejercicio personalizado',
}

export const pendingText = (n: number) =>
  `${n} ${n === 1 ? 'cambio pendiente' : 'cambios pendientes'}`

/** "hace 2 min" style age of an ISO instant. */
export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.floor((now - Date.parse(iso)) / 60_000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  return `el ${new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
}

function headline(s: SyncSnapshot): string {
  switch (s.status) {
    case 'synced':
      return s.lastSyncedAt ? `Sincronizado ${timeAgo(s.lastSyncedAt)}` : 'Sincronizado'
    case 'pending':
      return pendingText(s.pendingCount)
    case 'syncing':
      return 'Sincronizando…'
    case 'offline':
      return s.pendingCount > 0 ? `Sin conexión · ${pendingText(s.pendingCount)}` : 'Sin conexión'
    case 'authExpired':
      return 'Tu sesión caducó: vuelve a entrar para sincronizar'
  }
}

/** V12 sync detail (R6): status, pending count, last sync time, "Sincronizar ahora" and rejected changes. */
export function SyncDetail() {
  const { engine } = useShell()
  const snap = useSyncSnapshot()
  const errors = useLiveQuery(() => db.syncErrors.toArray(), [], [] as SyncErrorEntry[])
  const [busy, setBusy] = useState(false)
  const offline = snap.status === 'offline'

  async function syncNow() {
    setBusy(true)
    try {
      await (snap.status === 'authExpired' ? engine.resume() : engine.sync())
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section id="sync" title="Sincronización">
      <p className="font-bold">{headline(snap)}</p>
      <p className="text-sm text-polvo">
        Última sincronización:{' '}
        {snap.lastSyncedAt
          ? new Date(snap.lastSyncedAt).toLocaleString('es-ES', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          : 'nunca'}
      </p>
      <Button
        variant="secondary"
        disabled={offline || busy || snap.status === 'syncing'}
        onClick={() => void syncNow()}
      >
        Sincronizar ahora
      </Button>
      {errors.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold">
            {errors.length} {errors.length === 1 ? 'cambio rechazado' : 'cambios rechazados'} por el
            servidor
          </p>
          <ul className="flex flex-col gap-1 text-sm text-polvo">
            {errors.map((e) => (
              <li key={e.key}>
                {TABLE_LABEL[e.table]} · {e.reason} · {new Date(e.failedAt).toLocaleString('es-ES')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  )
}
