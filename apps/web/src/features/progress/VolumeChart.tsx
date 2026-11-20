import type { DayKey, WeightUnit } from '@training-log/domain'
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { AXIS_TICK, ChartFigure, TOOLTIP_PROPS } from './ChartFigure'
import { dayLabel, formatVolume, integer } from './format'

/** V10 weekly volume as bars. */
export function VolumeChart({
  data,
  unit,
}: {
  data: { week: DayKey; volume: number }[]
  unit: WeightUnit
}) {
  const rows = data.map((d) => ({ label: dayLabel(d.week), volume: d.volume }))
  const best = data.reduce(
    (a, b) => (b.volume > a.volume ? b : a),
    data[0] ?? { week: '', volume: 0 },
  )
  return (
    <ChartFigure
      title="Volumen semanal"
      summary={`${data.length} semanas; la de más volumen empezó el ${best.week ? dayLabel(best.week) : '—'} con ${formatVolume(best.volume, unit)}.`}
    >
      <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--concreto)" />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={12} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v: number) => integer(v)}
        />
        <Tooltip {...TOOLTIP_PROPS} formatter={(v) => [formatVolume(Number(v), unit), 'Volumen']} />
        <Bar
          dataKey="volume"
          fill="var(--oceano)"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartFigure>
  )
}
