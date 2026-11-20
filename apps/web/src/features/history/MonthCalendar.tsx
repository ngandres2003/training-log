import {
  addDays,
  daysBetween,
  weekStartOf,
  type DayKey,
  type WeekStart,
} from '@training-log/domain'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../../ui/Button'
import { formatLongDay, formatMonth, plural } from './format'
import type { HistorySession } from './history-data'
import { SessionRow } from './SessionList'

const LETTERS: Record<WeekStart, string[]> = {
  monday: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
  sunday: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
}

/** Month key (`YYYY-MM`) moved by `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

const lastDayOf = (month: string) => addDays(`${shiftMonth(month, 1)}-01`, -1)

/**
 * V9 month view: a calendar in the user's week start with one colored dot per routine trained
 * that day. Tapping a day lists its sessions below.
 */
export function MonthCalendar({
  month,
  weekStart,
  today,
  sessions,
  selectedDay,
  onSelectDay,
  onMonthChange,
}: {
  month: string
  weekStart: WeekStart
  today: DayKey
  sessions: HistorySession[]
  selectedDay: DayKey | null
  onSelectDay: (day: DayKey) => void
  onMonthChange: (month: string) => void
}) {
  const first = `${month}-01`
  const last = lastDayOf(month)
  const leading = daysBetween(weekStartOf(first, weekStart), first)
  const days = Array.from({ length: daysBetween(first, last) + 1 }, (_, i) => addDays(first, i))

  const byDay = new Map<DayKey, HistorySession[]>()
  for (const s of sessions) {
    if (s.day < first || s.day > last) continue
    byDay.set(s.day, [...(byDay.get(s.day) ?? []), s])
  }
  const selected = selectedDay ? (byDay.get(selectedDay) ?? []) : []
  // The list reads oldest first within a day.
  const selectedSorted = [...selected].sort((a, b) => a.startedAt.localeCompare(b.startedAt))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          aria-label="Mes anterior"
          onClick={() => onMonthChange(shiftMonth(month, -1))}
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Button>
        <h2 className="flex-1 text-center text-lg font-bold first-letter:uppercase">
          {formatMonth(month)}
        </h2>
        <Button
          variant="ghost"
          aria-label="Mes siguiente"
          disabled={month >= today.slice(0, 7)}
          onClick={() => onMonthChange(shiftMonth(month, 1))}
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {LETTERS[weekStart].map((l, i) => (
          <span key={i} aria-hidden="true" className="text-xs text-polvo">
            {l}
          </span>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((day) => {
          const list = byDay.get(day) ?? []
          const colors = [...new Set(list.map((s) => s.color ?? 'var(--polvo)'))].slice(0, 3)
          const isSelected = day === selectedDay
          return (
            <button
              key={day}
              type="button"
              aria-label={`${formatLongDay(day)}: ${list.length ? plural(list.length, 'sesión', 'sesiones') : 'sin entreno'}`}
              aria-pressed={isSelected}
              onClick={() => onSelectDay(day)}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg ${
                isSelected
                  ? 'bg-sol font-bold text-tinta'
                  : day === today
                    ? 'bg-asfalto font-bold'
                    : ''
              }`}
            >
              <span aria-hidden="true">{Number(day.slice(8))}</span>
              <span aria-hidden="true" className="flex h-1.5 gap-0.5">
                {colors.map((c) => (
                  <span key={c} className="size-1.5 rounded-full" style={{ backgroundColor: c }} />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      {selectedDay && (
        <section
          aria-label={`Sesiones del ${formatLongDay(selectedDay)}`}
          className="flex flex-col gap-2"
        >
          <h3 className="text-sm font-bold text-polvo first-letter:uppercase">
            {formatLongDay(selectedDay)}
          </h3>
          {selectedSorted.length === 0 ? (
            <p className="text-sm text-polvo">Sin entrenos este día.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {selectedSorted.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
