import type { Folder } from '@training-log/domain'
import { ChevronDown, ChevronUp, Repeat } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { deleteFolder, updateFolder } from '../../data/repositories/folders'
import { Button } from '../../ui/Button'
import { Menu } from './components/Menu'
import { ConfirmSheet, Sheet } from './components/Sheet'
import type { RoutineCardInfo } from './RoutineCard'
import { reorderRoutines } from './routine-ops'

/**
 * A collapsible folder in "Mis rutinas". A cycle folder shows its badge and numbers its
 * routines; its ⋯ menu renames, toggles cycle mode, reorders (Subir/Bajar) and deletes.
 */
export function FolderSection({
  folder,
  cards,
  renderCard,
}: {
  folder: Folder
  cards: RoutineCardInfo[]
  renderCard: (info: RoutineCardInfo, position: number | undefined, extra: ReactNode) => ReactNode
}) {
  const titleId = useId()
  const listId = useId()
  const [open, setOpen] = useState(true)
  const [reordering, setReordering] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(folder.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  const routines = cards.map((c) => c.routine)

  async function move(from: number, to: number) {
    await reorderRoutines(routines, from, to)
    setAnnouncement(`${routines[from]!.name}: posición ${to + 1} de ${routines.length}`)
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <h3 id={titleId} className="min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((o) => !o)}
            className="flex min-h-12 w-full items-center gap-2 text-left font-display text-xl uppercase"
          >
            {open ? (
              <ChevronUp aria-hidden="true" className="size-5 shrink-0 text-polvo" />
            ) : (
              <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-polvo" />
            )}
            <span className="truncate">{folder.name}</span>
          </button>
        </h3>
        {folder.isCycle && (
          <span className="inline-flex items-center gap-1 rounded-full border border-sol px-2 py-0.5 text-xs font-bold text-acento">
            <Repeat aria-hidden="true" className="size-3" />
            Ciclo
          </span>
        )}
        <Menu
          label={`Opciones de la carpeta ${folder.name}`}
          items={[
            { label: 'Renombrar', onSelect: () => setRenaming(true) },
            {
              label: folder.isCycle ? 'Desmarcar como programa en ciclo' : 'Marcar como programa en ciclo',
              onSelect: () => void updateFolder(folder.id, { isCycle: !folder.isCycle }),
            },
            { label: 'Reordenar rutinas', onSelect: () => setReordering(true) },
            { label: 'Eliminar carpeta', onSelect: () => setConfirmDelete(true), destructive: true },
          ]}
        />
      </div>

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {open && (
        <div id={listId} className="flex flex-col gap-2">
          {cards.length === 0 && <p className="text-sm text-polvo">Carpeta vacía.</p>}
          {cards.map((info, i) =>
            renderCard(
              info,
              folder.isCycle ? i + 1 : undefined,
              reordering ? (
                <div className="flex gap-2 pr-3">
                  <Button variant="secondary" disabled={i === 0} onClick={() => void move(i, i - 1)}>
                    Subir
                  </Button>
                  <Button variant="secondary" disabled={i === cards.length - 1} onClick={() => void move(i, i + 1)}>
                    Bajar
                  </Button>
                </div>
              ) : null,
            ),
          )}
          {reordering && (
            <Button variant="secondary" onClick={() => setReordering(false)}>
              Listo
            </Button>
          )}
        </div>
      )}

      {renaming && (
        <Sheet title="Renombrar carpeta" onClose={() => setRenaming(false)}>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim()) return
              void updateFolder(folder.id, { name: name.trim() }).then(() => setRenaming(false))
            }}
          >
            <label className="flex flex-col gap-2 text-sm text-polvo">
              Nombre de la carpeta
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-h-12 rounded-lg border border-concreto bg-hierro px-4 text-base text-arena"
              />
            </label>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setRenaming(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={!name.trim()}>
                Guardar
              </Button>
            </div>
          </form>
        </Sheet>
      )}

      {confirmDelete && (
        <ConfirmSheet
          title={`¿Eliminar la carpeta «${folder.name}»?`}
          description="Sus rutinas no se borran: pasan a «Sin carpeta»."
          confirmLabel="Eliminar"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void deleteFolder(folder.id).then(() => setConfirmDelete(false))}
        />
      )}
    </section>
  )
}
