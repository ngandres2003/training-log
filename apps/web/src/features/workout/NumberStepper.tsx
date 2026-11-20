import { Minus, Plus } from 'lucide-react'

/** − value + control for the focused set row (kg ±2,5 · lb ±5 · reps ±1 · seconds ±5). */
export function NumberStepper({
  label,
  value,
  onStep,
}: {
  /** e.g. "kg fila 3"; the buttons read "Restar kg fila 3" / "Sumar kg fila 3". */
  label: string
  value: string
  onStep: (direction: 1 | -1) => void
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-1 rounded-lg bg-hierro">
      <button
        type="button"
        aria-label={`Restar ${label}`}
        onClick={() => onStep(-1)}
        className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg text-arena"
      >
        <Minus aria-hidden="true" className="size-5" />
      </button>
      <span className="min-w-0 truncate text-center font-display text-lg" aria-hidden="true">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Sumar ${label}`}
        onClick={() => onStep(1)}
        className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg text-arena"
      >
        <Plus aria-hidden="true" className="size-5" />
      </button>
    </div>
  )
}
