import { weekStartOf, type DayKey, type WeekStart } from '@training-log/domain'
import { useId, useState } from 'react'
import { Link } from 'react-router'
import { formatRowDay, formatShortDay, plural } from './format'
import type { HistorySession } from './history-data'

/** One session row; taps open V8 (`/historial/sesiones/:workoutId`). */
export function SessionRow({ session }: { session: HistorySession }) {
  const meta = [
    formatRowDay(session.day),
    session.minutes != null ? `${session.minutes} min` : null,
    plural(session.sets, 'serie', 'series'),
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <li>
      <Link
        to={`/historial/sesiones/${session.id}`}
        className="flex min-h-12 items-stretch overflow-hidden rounded-xl border border-concreto bg-asfalto"
      >
        <span
          aria-hidden="true"
          className="w-1.5 shrink-0 bg-concreto"
          style={session.color ? { backgroundColor: session.color } : undefined}
        />
        <span className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2">
          <span className="truncate font-bold">{session.title}</span>
          <span className="truncate text-sm text-polvo">{meta}</span>
        </span>
      </Link>
    </li>
  )
}

/** Filter key: a routine id, or FREE for workouts without a routine. */
const FREE = 'libre'
const ALL = ''
const keyOf = (s: HistorySession) => s.routineId ?? FREE

/** V9 session list: newest first, grouped by week, filterable by routine (deleted ones included, R12). */
export function SessionList({
  sessions,
  weekStart,
}: {
  sessions: HistorySession[]
  weekStart: WeekStart
}) {
  const [filter, setFilter] = useState(ALL)
  const selectId = useId()

  // Newest session's title per routine, so a deleted routine reads "Nombre (eliminada)".
  const options = new Map<string, string>()
  for (const s of sessions)
    if (!options.has(keyOf(s))) options.set(keyOf(s), s.routineId ? s.title : 'Entreno libre')
  const sortedOptions = [...options].sort((a, b) => a[1].localeCompare(b[1], 'es'))

  const visible = filter === ALL ? sessions : sessions.filter((s) => keyOf(s) === filter)
  const weeks = new Map<DayKey, HistorySession[]>()
  for (const s of visible) {
    const week = weekStartOf(s.day, weekStart)
    weeks.set(week, [...(weeks.get(week) ?? []), s])
  }

  return (
    <section aria-labelledby="sesiones" className="flex flex-col gap-3">
      <h2 id="sesiones" className="font-display text-2xl uppercase">
        Sesiones
      </h2>
      <label htmlFor={selectId} className="text-sm text-polvo">
        Filtrar por rutina
      </label>
      <select
        id={selectId}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="min-h-12 rounded-lg border border-concreto bg-asfalto px-3 text-arena"
      >
        <option value={ALL}>Todas las rutinas</option>
        {sortedOptions.map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      {[...weeks].map(([week, list]) => (
        <div key={week} className="flex flex-col gap-2">
          <h3 className="text-sm font-bold text-polvo">Semana del {formatShortDay(week)}</h3>
          <ul className="flex flex-col gap-2">
            {list.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
