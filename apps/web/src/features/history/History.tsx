import { adherence, heatmapThresholds, weeklyStreak, type DayKey } from '@training-log/domain'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../../app/PageHeader'
import { Button } from '../../ui/Button'
import { ChoiceGroup } from '../../ui/ChoiceGroup'
import { todayKey } from '../routines/format'
import { plural } from './format'
import { useHistoryData } from './history-data'
import { MonthCalendar } from './MonthCalendar'
import { SessionList } from './SessionList'
import { YearHeatmap } from './YearHeatmap'

type View = 'year' | 'month'

const VIEWS = [
  { value: 'year', label: 'Año' },
  { value: 'month', label: 'Mes' },
] as const

function Indicator({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-concreto bg-asfalto px-3 py-2">
      <dt className="text-sm text-polvo">{label}</dt>
      <dd className="font-display text-2xl">{value}</dd>
    </div>
  )
}

/**
 * V9 · Historial: year heatmap (series per day, R27) or month calendar, streak and adherence
 * indicators, and the session list grouped by week and filterable by routine.
 */
export function History() {
  const data = useHistoryData()
  const today = todayKey()
  const currentYear = Number(today.slice(0, 4))
  const [year, setYear] = useState(currentYear)
  const [view, setView] = useState<View>('year')
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selectedDay, setSelectedDay] = useState<DayKey | null>(null)

  if (!data) return <PageHeader title="Historial" />

  const { sessions, setsByDay, settings } = data
  const trainedDays = sessions.map((s) => s.day)
  const firstYear = Math.min(currentYear, ...trainedDays.map((d) => Number(d.slice(0, 4))))
  const yearStart = `${year}-01-01`
  const yearEnd = year === currentYear ? today : `${year}-12-31`
  const daysThisYear = new Set(trainedDays.filter((d) => d >= yearStart && d <= yearEnd)).size
  const streak = weeklyStreak({
    trainedDays,
    today,
    weekStart: settings.weekStart,
    weeklyGoal: settings.weeklyGoal,
  })
  const adherencePct = adherence({
    trainedDays,
    from: yearStart,
    to: yearEnd,
    weeklyGoal: settings.weeklyGoal,
  })

  /** Heatmap tap: open the month of the tapped day (cells are too small to select days). */
  function openMonthAt(day: DayKey) {
    setMonth(day.slice(0, 7))
    setSelectedDay(null)
    setView('month')
  }

  return (
    <>
      <PageHeader title="Historial" />
      <div className="flex flex-col gap-5">
        <ChoiceGroup label="Vista" choices={VIEWS} value={view} onChange={setView} />

        {view === 'year' ? (
          <section aria-label="Año" className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                aria-label="Año anterior"
                disabled={year <= firstYear}
                onClick={() => setYear(year - 1)}
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
              </Button>
              <h2 className="flex-1 text-center text-lg font-bold">{year}</h2>
              <Button
                variant="ghost"
                aria-label="Año siguiente"
                disabled={year >= currentYear}
                onClick={() => setYear(year + 1)}
              >
                <ChevronRight aria-hidden="true" className="size-5" />
              </Button>
            </div>
            <YearHeatmap
              year={year}
              weekStart={settings.weekStart}
              setsByDay={setsByDay}
              thresholds={heatmapThresholds(setsByDay.values())}
              onSelectDay={openMonthAt}
            />
            {daysThisYear === 0 && (
              <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-concreto px-4 py-6 text-center">
                <p className="font-bold">Sin entrenos en {year}</p>
                <p className="text-sm text-polvo">Las sesiones que termines aparecerán aquí.</p>
              </div>
            )}
          </section>
        ) : (
          <MonthCalendar
            month={month}
            weekStart={settings.weekStart}
            today={today}
            sessions={sessions}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onMonthChange={(m) => {
              setMonth(m)
              setSelectedDay(null)
            }}
          />
        )}

        <section aria-labelledby="indicadores">
          <h2 id="indicadores" className="sr-only">
            Indicadores
          </h2>
          <dl className="grid grid-cols-2 gap-2">
            <Indicator label="Racha actual" value={plural(streak.current, 'semana', 'semanas')} />
            <Indicator label="Mejor racha" value={plural(streak.best, 'semana', 'semanas')} />
            <Indicator label={`Días entrenados en ${year}`} value={String(daysThisYear)} />
            <Indicator label="Adherencia" value={`${adherencePct} %`} />
          </dl>
        </section>

        {sessions.length > 0 && <SessionList sessions={sessions} weekStart={settings.weekStart} />}
      </div>
    </>
  )
}
