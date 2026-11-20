import {
  addDays,
  daysBetween,
  heatmapLevel,
  weekStartOf,
  type DayKey,
  type HeatmapThresholds,
  type WeekStart,
} from '@training-log/domain'
import { formatLongDayYear, formatShortMonth, plural } from './format'

const CELL = 10
const GAP = 2
const STEP = CELL + GAP
const LEFT = 14 // weekday letters
const TOP = 12 // month labels

const LEVEL_OPACITY = [0, 0.3, 0.5, 0.75, 1]

const LETTERS: Record<WeekStart, string[]> = {
  monday: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
  sunday: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
}

/** Level 0 is a Concreto square; levels 1–4 are Sol at increasing opacity. */
const levelFill = (level: number) =>
  level === 0
    ? { className: 'fill-concreto' }
    : { className: 'fill-sol', fillOpacity: LEVEL_OPACITY[level] }

/**
 * V9 year heatmap (R27): GitHub-style SVG, columns are weeks and rows are weekdays in the
 * user's week start; intensity is completed sets of the day (4 levels + empty). Each cell has a
 * text label for screen readers. Cells are too small for a 48 px target, so tapping one hands
 * its day to `onSelectDay` (History opens that month, where days are selectable).
 */
export function YearHeatmap({
  year,
  weekStart,
  setsByDay,
  thresholds,
  onSelectDay,
}: {
  year: number
  weekStart: WeekStart
  setsByDay: Map<DayKey, number>
  thresholds: HeatmapThresholds
  onSelectDay: (day: DayKey) => void
}) {
  const first = `${year}-01-01`
  const last = `${year}-12-31`
  const gridStart = weekStartOf(first, weekStart)
  const columns = Math.floor(daysBetween(gridStart, last) / 7) + 1
  const width = LEFT + columns * STEP
  const height = TOP + 7 * STEP

  const days = Array.from({ length: daysBetween(first, last) + 1 }, (_, i) => addDays(first, i))

  return (
    <div className="flex flex-col gap-2">
      <svg
        role="group"
        aria-label={`Mapa de calor de ${year}`}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full cursor-pointer"
      >
        {LETTERS[weekStart].map((letter, row) =>
          row % 2 === 0 ? (
            <text
              key={row}
              aria-hidden="true"
              x={0}
              y={TOP + row * STEP + CELL - 1}
              className="fill-polvo text-[8px]"
            >
              {letter}
            </text>
          ) : null,
        )}
        {days.map((day) => {
          const offset = daysBetween(gridStart, day)
          const col = Math.floor(offset / 7)
          const x = LEFT + col * STEP
          return day.endsWith('-01') ? (
            <text
              key={`m-${day}`}
              aria-hidden="true"
              x={x}
              y={TOP - 3}
              className="fill-polvo text-[8px]"
            >
              {formatShortMonth(day)}
            </text>
          ) : null
        })}
        {days.map((day) => {
          const offset = daysBetween(gridStart, day)
          const col = Math.floor(offset / 7)
          const row = offset % 7
          const count = setsByDay.get(day) ?? 0
          const level = heatmapLevel(count, thresholds)
          const label = `${formatLongDayYear(day)}: ${count ? plural(count, 'serie', 'series') : 'sin entreno'}`
          return (
            <rect
              key={day}
              role="img"
              aria-label={label}
              data-col={col}
              data-row={row}
              data-level={level}
              x={LEFT + col * STEP}
              y={TOP + row * STEP}
              width={CELL}
              height={CELL}
              rx={2}
              {...levelFill(level)}
              onClick={() => onSelectDay(day)}
            />
          )
        })}
      </svg>
      <div aria-hidden="true" className="flex items-center justify-end gap-1 text-xs text-polvo">
        <span>Menos</span>
        <svg viewBox={`0 0 ${5 * STEP} ${CELL}`} className="h-2.5">
          {[0, 1, 2, 3, 4].map((level) => (
            <rect
              key={level}
              x={level * STEP}
              width={CELL}
              height={CELL}
              rx={2}
              {...levelFill(level)}
            />
          ))}
        </svg>
        <span>Más</span>
      </div>
    </div>
  )
}
