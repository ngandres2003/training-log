import type { Id } from '@training-log/domain'

/**
 * Contract for V4 in selection mode, used by V3 (routine editor) and V5 (add exercise).
 * U12 owns the implementation; callers render it as a full-screen layer.
 */
export interface ExercisePickerProps {
  /** Ids already in the routine or workout; shown as already added. */
  excludeIds?: Id[]
  onConfirm: (exerciseIds: Id[]) => void
  onCancel: () => void
}

// Placeholder until U12 lands; replaced by the real V4 selector.
export function ExercisePicker({ onCancel }: ExercisePickerProps) {
  return (
    <div role="dialog" aria-label="Seleccionar ejercicios">
      <button type="button" onClick={onCancel}>
        Cerrar
      </button>
    </div>
  )
}
