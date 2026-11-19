import type { Routine } from '@training-log/domain'
import { Play } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router'

/** "Toca hoy" (R10): the suggested routine with its own ▶ Iniciar. */
export function TodaySuggestion({ routine, onStart }: { routine: Routine; onStart: () => void }) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className="flex items-center gap-3 rounded-xl border border-sol/60 bg-asfalto p-3"
    >
      <span aria-hidden="true" className="h-12 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: routine.color }} />
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="text-sm font-bold text-sol uppercase">
          Toca hoy
        </h2>
        <Link to={`rutinas/${routine.id}`} className="block truncate font-display text-2xl uppercase">
          {routine.name}
        </Link>
      </div>
      <button
        type="button"
        onClick={onStart}
        aria-label={`Iniciar ${routine.name}`}
        className="inline-flex min-h-12 items-center gap-1 rounded-lg bg-sol px-4 font-bold text-hierro"
      >
        <Play aria-hidden="true" className="size-4 fill-current" />
        Iniciar
      </button>
    </section>
  )
}
