import type { Exercise, Id, PrKind, RecordEvent, WeightUnit } from '@training-log/domain'
import { Trophy } from 'lucide-react'
import { Link } from 'react-router'
import { shortDate } from '../routines/format'
import { setText } from './format'

export const PR_LABELS: Record<PrKind, string> = {
  max_weight: 'Peso máximo',
  e1rm: '1RM estimado',
  reps_at_weight: 'Más reps con ese peso',
  max_reps: 'Más reps',
  max_added_load: 'Mayor lastre',
  max_duration: 'Mayor duración',
}

/** V10 "Récords recientes": the latest PRs with their date. */
export function RecentRecords({
  events,
  byId,
  unit,
}: {
  events: RecordEvent[]
  byId: Map<Id, Exercise>
  unit: WeightUnit
}) {
  return (
    <section aria-labelledby="recent-records" className="flex flex-col gap-2">
      <h2 id="recent-records" className="font-display text-xl uppercase">
        Récords recientes
      </h2>
      {events.length === 0 ? (
        <p className="text-polvo">
          Sin récords en este periodo. Tu primera sesión de cada ejercicio fija la marca base.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((ev) => {
            const exercise = byId.get(ev.exerciseId)
            return (
              <li key={ev.set.id}>
                <Link
                  to={`/progreso/ejercicios/${ev.exerciseId}`}
                  className="flex items-center gap-3 rounded-xl border border-concreto bg-asfalto px-4 py-3"
                >
                  <Trophy aria-hidden="true" className="size-5 shrink-0 text-atardecer" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-bold">{exercise?.name ?? 'Ejercicio'}</span>
                    <span className="text-sm text-polvo">
                      {PR_LABELS[ev.kind]} ·{' '}
                      {setText(ev.set, exercise?.trackingType ?? 'weight_reps', unit)}
                    </span>
                  </span>
                  <span className="text-sm text-polvo">{shortDate(ev.startedAt)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
