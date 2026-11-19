import { addDays, type DayKey } from '@training-log/domain'

const NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

/** V1 week strip: one letter per day with a filled dot on trained days. */
export function WeekStrip({ weekStart, today, trained }: { weekStart: DayKey; today: DayKey; trained: Set<DayKey> }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  return (
    <ol aria-label="Esta semana" className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
        const done = trained.has(day)
        const isToday = day === today
        return (
          <li
            key={day}
            aria-label={`${NAMES[weekday]}${isToday ? ' (hoy)' : ''}: ${done ? 'entrenado' : 'sin entreno'}`}
            className={`flex flex-col items-center gap-1 rounded-lg py-1 ${isToday ? 'bg-asfalto' : ''}`}
          >
            <span aria-hidden="true" className={`text-xs ${isToday ? 'font-bold text-arena' : 'text-polvo'}`}>
              {LETTERS[weekday]}
            </span>
            <span
              aria-hidden="true"
              className={`size-2.5 rounded-full ${done ? 'bg-sol' : 'border border-concreto'}`}
            />
          </li>
        )
      })}
    </ol>
  )
}
