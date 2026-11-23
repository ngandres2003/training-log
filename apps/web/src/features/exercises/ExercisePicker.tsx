import type { Id } from '@training-log/domain'
import { X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../ui/Button'
import { CreateExercise } from './CreateExercise'
import { ExerciseBrowser } from './ExerciseBrowser'
import { useLayer } from '../../ui/layer'

/**
 * Contract for V4 in selection mode, used by V3 (routine editor) and V5 (add exercise).
 * Callers render it as a full-screen layer.
 */
export interface ExercisePickerProps {
  /** Ids already in the routine or workout; shown as already added. */
  excludeIds?: Id[]
  onConfirm: (exerciseIds: Id[]) => void
  onCancel: () => void
}

/** V4 in selection mode: check exercises and confirm with "Añadir (n)". Works offline. */
export function ExercisePicker({ excludeIds = [], onConfirm, onCancel }: ExercisePickerProps) {
  const [selected, setSelected] = useState<Id[]>([])
  const [creating, setCreating] = useState<{ initialName: string } | null>(null)

  useLayer(onCancel)
  // Creating an exercise is a screen of its own: Back returns to the list.
  useLayer(() => setCreating(null), creating !== null)

  const toggle = (id: Id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Seleccionar ejercicios"
      className="fixed inset-0 z-40 overflow-y-auto bg-hierro text-arena"
    >
      <div className="mx-auto flex min-h-full max-w-[480px] flex-col px-4">
        {creating ? (
          <CreateExercise
            initialName={creating.initialName}
            onCancel={() => setCreating(null)}
            onSaved={(exercise) => {
              // A new exercise created from the selector comes back already checked.
              setSelected((s) => [...s, exercise.id])
              setCreating(null)
            }}
          />
        ) : (
          <>
            <header className="flex items-center gap-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
              <button
                type="button"
                onClick={onCancel}
                aria-label="Cerrar"
                className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg text-polvo"
              >
                <X aria-hidden="true" className="size-6" />
              </button>
              <h2 className="min-w-0 flex-1 truncate font-display text-3xl uppercase">Ejercicios</h2>
            </header>
            <div className="flex-1 pb-24">
              <ExerciseBrowser
                mode="select"
                selectedIds={selected}
                excludeIds={excludeIds}
                onToggle={toggle}
                onCreate={(initialName) => setCreating({ initialName })}
              />
            </div>
            <div className="sticky bottom-0 -mx-4 border-t border-concreto bg-hierro px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Button className="w-full" disabled={selected.length === 0} onClick={() => onConfirm(selected)}>
                {`Añadir (${selected.length})`}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
