import { formatWeight, type Id, type OtherRoutineChip as Chip, type TrackingType, type WeightUnit } from '@training-log/domain'
import { ChevronDown, History } from 'lucide-react'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { shortDate } from '../routines/format'
import { fullSet } from './format'

/**
 * "En otra rutina" (R19): folded, the most recent session outside this routine with its best
 * set; unfolded, also the best historical mark (highest e1RM) and a link to V11. The caller
 * renders nothing when the domain returns no chip (AE8).
 */
export function OtherRoutineChip({
  chip,
  names,
  exerciseId,
  trackingType,
  unit,
}: {
  chip: Chip
  names: { recent: string; best: string }
  exerciseId: Id
  trackingType: TrackingType
  unit: WeightUnit
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const recent = `${names.recent} · ${shortDate(chip.recent.startedAt)} · ${fullSet(chip.recent.bestSet, trackingType, unit)}`
  const best = `${names.best} · ${shortDate(chip.best.startedAt)} · ${fullSet(chip.best.set, trackingType, unit)}`

  return (
    <div className="rounded-xl border border-borde-fuerte bg-hierro/40">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-12 w-full items-center gap-2 px-3 text-left text-sm"
      >
        <History aria-hidden="true" className="size-4 shrink-0 text-polvo" />
        <span className="shrink-0 text-xs font-bold text-polvo uppercase">En otra rutina</span>
        <span className="min-w-0 flex-1 truncate text-arena">{recent}</span>
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-polvo ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <section id={panelId} aria-label="En otra rutina" className="flex flex-col gap-2 px-3 pb-3 text-sm">
          <p className="flex flex-col">
            <span className="text-xs text-polvo uppercase">Más reciente</span>
            <span>{recent}</span>
          </p>
          <p className="flex flex-col">
            <span className="text-xs text-polvo uppercase">Mejor marca</span>
            <span>
              {best}
              {chip.best.e1rm != null && <span className="text-polvo"> · e1RM {formatWeight(chip.best.e1rm, unit)}</span>}
            </span>
          </p>
          <Link
            to={`/progreso/ejercicios/${exerciseId}`}
            className="inline-flex min-h-12 items-center font-bold text-acento uppercase"
          >
            Ver historial
          </Link>
        </section>
      )}
    </div>
  )
}
