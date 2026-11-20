import type { Routine } from '@training-log/domain'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { PageHeader } from '../../app/PageHeader'
import { deleteRoutine, listArchivedRoutines, unarchiveRoutine } from '../../data/repositories/routines'
import { Button } from '../../ui/Button'
import { BackLink } from './components/BackLink'
import { ConfirmSheet } from './components/Sheet'

/** "Rutinas archivadas" (R11, spec F8): restore or delete archived routines. */
export function ArchivedRoutines() {
  const routines = useLiveQuery(listArchivedRoutines, [])
  const [deleting, setDeleting] = useState<Routine | null>(null)
  const [message, setMessage] = useState('')

  return (
    <>
      <PageHeader title="Rutinas archivadas" leading={<BackLink to="/" />} />
      {routines && routines.length === 0 && <p className="text-polvo">No hay rutinas archivadas.</p>}
      <ul className="flex flex-col gap-2">
        {routines?.map((r) => (
          <li key={r.id}>
            <article aria-label={r.name} className="flex items-center gap-2 rounded-xl border border-concreto bg-asfalto p-3">
              <span aria-hidden="true" className="h-10 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
              <h2 className="min-w-0 flex-1 truncate font-bold">{r.name}</h2>
              <Button
                variant="secondary"
                onClick={() => void unarchiveRoutine(r.id).then(() => setMessage(`«${r.name}» restaurada`))}
              >
                Restaurar
              </Button>
              <Button variant="ghost" onClick={() => setDeleting(r)}>
                Eliminar
              </Button>
            </article>
          </li>
        ))}
      </ul>
      <p role="status" className="sr-only">
        {message}
      </p>
      {deleting && (
        <ConfirmSheet
          title={`¿Eliminar «${deleting.name}»?`}
          description={`Se borra la plantilla. Sus sesiones se conservan en Historial y Progreso como «${deleting.name} (eliminada)».`}
          confirmLabel="Eliminar"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const r = deleting
            setDeleting(null)
            void deleteRoutine(r.id).then(() => setMessage(`«${r.name}» eliminada`))
          }}
        />
      )}
    </>
  )
}
