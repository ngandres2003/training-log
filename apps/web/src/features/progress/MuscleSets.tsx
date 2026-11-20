import { MUSCLES, type MovementPattern, type MuscleId } from '@training-log/domain'
import { Bar, BarChart, CartesianGrid, ReferenceArea, Tooltip, XAxis, YAxis } from 'recharts'
import { AXIS_TICK, ChartFigure, TOOLTIP_PROPS } from './ChartFigure'
import { decimal1 } from '../routines/format'

/** Recommended weekly sets per muscle group. */
export const RECOMMENDED_SETS = { min: 10, max: 20 } as const

/** V10 sets per muscle group per week, as horizontal bars over the recommended 10–20 band. */
export function MuscleSets({ perWeek }: { perWeek: Map<MuscleId, number> }) {
  const rows = MUSCLES.flatMap((m) => {
    const sets = perWeek.get(m.id) ?? 0
    return sets > 0 ? [{ label: m.label, sets: Math.round(sets * 10) / 10 }] : []
  }).sort((a, b) => b.sets - a.sets)
  if (rows.length === 0) return null
  const inBand = rows.filter(
    (r) => r.sets >= RECOMMENDED_SETS.min && r.sets <= RECOMMENDED_SETS.max,
  ).length
  const max = Math.max(RECOMMENDED_SETS.max + 2, ...rows.map((r) => r.sets))
  return (
    <ChartFigure
      title="Series por grupo muscular (media semanal)"
      summary={`${rows.map((r) => `${r.label} ${decimal1(r.sets)}`).join(', ')}. ${inBand} de ${rows.length} grupos dentro de la banda recomendada de 10 a 20 series.`}
      height={Math.max(120, rows.length * 28 + 32)}
    >
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke="var(--concreto)" />
        <ReferenceArea
          x1={RECOMMENDED_SETS.min}
          x2={RECOMMENDED_SETS.max}
          fill="var(--sol)"
          fillOpacity={0.12}
        />
        <XAxis
          type="number"
          domain={[0, Math.ceil(max)]}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={96}
        />
        <Tooltip {...TOOLTIP_PROPS} formatter={(v) => [decimal1(Number(v)), 'Series por semana']} />
        <Bar
          dataKey="sets"
          fill="var(--oceano)"
          radius={[0, 4, 4, 0]}
          barSize={14}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartFigure>
  )
}

const PATTERN_LABELS: Record<MovementPattern, string> = {
  push: 'Empuje',
  pull: 'Tirón',
  legs: 'Pierna',
  core: 'Core',
}

/** Push / pull / legs balance as labeled meters (percentages always shown as text). */
export function MovementBalance({ balance }: { balance: Record<MovementPattern, number> | null }) {
  if (!balance) return null
  return (
    <section
      aria-label="Balance empuje / tirón / pierna"
      className="rounded-xl border border-concreto bg-asfalto p-3"
    >
      <h3 className="mb-2 text-sm text-polvo">Balance empuje / tirón / pierna</h3>
      <dl className="flex flex-col gap-2">
        {(Object.keys(PATTERN_LABELS) as MovementPattern[]).map((p) => (
          <div key={p} className="grid grid-cols-[5rem_1fr_3rem] items-center gap-2">
            <dt className="text-sm">{PATTERN_LABELS[p]}</dt>
            <div aria-hidden="true" className="h-2 rounded-full bg-concreto">
              <div className="h-2 rounded-full bg-oceano" style={{ width: `${balance[p]}%` }} />
            </div>
            <dd className="text-right text-sm">{Math.round(balance[p])} %</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
