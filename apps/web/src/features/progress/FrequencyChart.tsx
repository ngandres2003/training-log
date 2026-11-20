import type { DayKey } from '@training-log/domain'
import { Bar, BarChart, CartesianGrid, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'
import { AXIS_TICK, ChartFigure, TOOLTIP_PROPS } from './ChartFigure'
import { dayLabel } from './format'

/** V10 trained days per week against the weekly goal. */
export function FrequencyChart({
  data,
  goal,
}: {
  data: { week: DayKey; days: number }[]
  goal: number
}) {
  const rows = data.map((d) => ({ label: dayLabel(d.week), days: d.days }))
  const met = data.filter((d) => d.days >= goal).length
  return (
    <ChartFigure
      title="Frecuencia semanal"
      summary={`Objetivo de ${goal} días por semana, cumplido en ${met} de ${data.length} semanas.`}
    >
      <BarChart data={rows} margin={{ top: 12, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--concreto)" />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={12} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={28}
          allowDecimals={false}
          domain={[0, (max: number) => Math.max(max, goal, 1)]}
        />
        <Tooltip {...TOOLTIP_PROPS} formatter={(v) => [`${String(v)} días`, 'Entrenados']} />
        <ReferenceLine
          y={goal}
          stroke="var(--sol)"
          strokeDasharray="4 4"
          label={{
            value: 'Objetivo',
            position: 'insideTopRight',
            fill: 'var(--polvo)',
            fontSize: 12,
          }}
        />
        <Bar
          dataKey="days"
          fill="var(--oceano)"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartFigure>
  )
}
