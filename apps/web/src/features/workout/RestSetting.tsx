import { Timer } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../ui/Button'
import { ChoiceGroup } from '../../ui/ChoiceGroup'
import { Sheet } from '../routines/components/Sheet'
import { restClock } from './format'
import { NumberStepper } from './NumberStepper'

const STEP_SEC = 15
const MAX_SEC = 15 * 60
const PRESETS = [60, 90, 120, 180].map((s) => ({ value: s, label: restClock(s * 1000) }))

/** "Descanso 1:30", or "Sin descanso" for null. */
export const restText = (restSec: number | null) => (restSec ? `Descanso ${restClock(restSec * 1000)}` : 'Sin descanso')

/** −15 s / +15 s; going below 15 s means no rest, and + from no rest starts at 15 s. */
export function stepRest(restSec: number | null, direction: 1 | -1): number | null {
  const next = (restSec ?? 0) + direction * STEP_SEC
  if (next <= 0) return null
  return Math.min(next, MAX_SEC)
}

/**
 * The exercise's rest in V5 (per workout exercise, null = no rest timer). Tapping it opens a small
 * sheet with ±15 s, presets and "Sin descanso"; every change saves at once, and the next ✓ uses it.
 */
export function RestSetting({
  exerciseName,
  restSec,
  onSave,
}: {
  exerciseName: string
  restSec: number | null
  /** Absent where rest cannot change (a finished session): the value is shown as text. */
  onSave?: (restSec: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  // Mirrors the saved value while the sheet is open so quick taps build on each other.
  const [value, setValue] = useState(restSec)

  if (!onSave) {
    return <span className="text-sm text-polvo">{restText(restSec)}</span>
  }

  const change = (next: number | null) => {
    setValue(next)
    onSave(next)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setValue(restSec)
          setOpen(true)
        }}
        className="-my-3 inline-flex min-h-12 items-center gap-1 self-start text-sm text-polvo underline decoration-dotted underline-offset-4"
      >
        <Timer aria-hidden="true" className="size-4" />
        {restText(restSec)}
        <span className="sr-only">, {exerciseName}. Cambiar</span>
      </button>

      {open && (
        <Sheet
          title="Descanso entre series"
          description={`Tras cada serie de ${exerciseName}.`}
          onClose={() => setOpen(false)}
        >
          <NumberStepper
            label="descanso"
            value={value ? restClock(value * 1000) : 'Sin descanso'}
            onStep={(d) => change(stepRest(value, d))}
          />
          <p role="status" className="sr-only">
            {restText(value)}
          </p>
          <ChoiceGroup label="Rápido" choices={PRESETS} value={value ?? 0} onChange={change} />
          <Button
            variant="secondary"
            aria-pressed={value === null}
            className={value === null ? '!border-sol font-bold' : ''}
            onClick={() => change(null)}
          >
            Sin descanso
          </Button>
          <Button onClick={() => setOpen(false)}>Listo</Button>
        </Sheet>
      )}
    </>
  )
}
