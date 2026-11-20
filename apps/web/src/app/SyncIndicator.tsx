import { CloudCheck, CloudOff, CloudUpload } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { indicatorState, type IndicatorState, type SyncStatusStore } from '../data/sync/status'
import { useShell } from './shell'

const VISUAL: Record<IndicatorState['state'], { label: string; Icon: typeof CloudCheck; color: string }> = {
  // Shape distinguishes the state, not only color (design: check / arrow / crossed cloud).
  sincronizado: { label: 'sincronizado', Icon: CloudCheck, color: 'text-polvo' },
  pendiente: { label: 'pendiente', Icon: CloudUpload, color: 'text-acento' },
  'sin-conexion': { label: 'sin conexión', Icon: CloudOff, color: 'text-arena' },
}

export function useSyncSnapshot(store?: SyncStatusStore) {
  const shell = useShell()
  const s = store ?? shell.engine.status
  return useSyncExternalStore(s.subscribe, s.getSnapshot)
}

function describe(view: IndicatorState): string {
  const base = `Sincronización: ${VISUAL[view.state].label}`
  if (view.state === 'sincronizado' || view.pendingCount === 0) return base
  const n = view.pendingCount
  return `${base}, ${n} ${n === 1 ? 'cambio pendiente' : 'cambios pendientes'}`
}

/**
 * Global sync indicator (R6): three visual states from U7's status store. Tapping it opens
 * the sync detail in V12 (`/perfil#sync`). Status changes are announced politely (KTD16).
 */
export function SyncIndicator({ store }: { store?: SyncStatusStore }) {
  const view = indicatorState(useSyncSnapshot(store))
  const { Icon, color } = VISUAL[view.state]
  const text = describe(view)
  return (
    <>
      <Link
        to={{ pathname: '/perfil', hash: 'sync' }}
        aria-label={text}
        data-state={view.state}
        className={`inline-flex min-h-12 min-w-12 items-center justify-center gap-1 rounded-lg ${color}`}
      >
        <Icon aria-hidden="true" className="size-6" />
        {view.state !== 'sincronizado' && view.pendingCount > 0 && (
          <span aria-hidden="true" className="font-display text-base">
            {view.pendingCount}
          </span>
        )}
      </Link>
      <span role="status" aria-live="polite" className="sr-only">
        {text}
      </span>
    </>
  )
}
