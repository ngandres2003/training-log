import {
  exerciseSessionPoints,
  exerciseSessions,
  formatWeight,
  personalRecords,
  type ExerciseSessionPoint,
  type Id,
  type PersonalRecords,
  type TrackingType,
  type WeightUnit,
  type WorkoutSet,
} from '@training-log/domain'
import { useId, useState } from 'react'
import { Link, useParams } from 'react-router'
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader } from '../../app/PageHeader'
import { useExerciseLookup } from '../exercises/catalog'
import { BackLink } from '../routines/components/BackLink'
import { shortDate } from '../routines/format'
import { AXIS_TICK, ChartFigure, TOOLTIP_PROPS } from './ChartFigure'
import { formatDuration, formatVolume, integer, setText } from './format'
import { KpiCard } from './KpiCard'
import { useProgressData } from './load'

interface Series {
  title: string
  value: (p: ExerciseSessionPoint) => number | null
  format: (n: number) => string
}

/** What V11 graphs for each tracking type. */
function seriesFor(trackingType: TrackingType, unit: WeightUnit): Series[] {
  const weight = (n: number) => formatWeight(n, unit)
  switch (trackingType) {
    case 'weight_reps':
      return [
        { title: '1RM estimado', value: (p) => p.e1rm, format: weight },
        { title: 'Peso máximo', value: (p) => p.maxWeight, format: weight },
        {
          title: 'Volumen por sesión',
          value: (p) => p.volume,
          format: (n) => formatVolume(n, unit),
        },
      ]
    case 'reps':
      return [
        { title: 'Reps máximas', value: (p) => p.maxReps, format: (n) => `${n} reps` },
        { title: 'Lastre máximo', value: (p) => p.maxAddedLoad, format: weight },
      ]
    case 'time':
      return [{ title: 'Duración máxima', value: (p) => p.maxDuration, format: formatDuration }]
  }
}

function TrendChart({ series, points }: { series: Series; points: ExerciseSessionPoint[] }) {
  const data = points.flatMap((p) => {
    const v = series.value(p)
    return v == null ? [] : [{ label: shortDate(p.startedAt), v: Math.round(v * 10) / 10 }]
  })
  if (data.length < 2) return null
  const first = data[0]!
  const last = data.at(-1)!
  return (
    <ChartFigure
      title={series.title}
      summary={`${data.length} sesiones: de ${series.format(first.v)} el ${first.label} a ${series.format(last.v)} el ${last.label}.`}
    >
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--concreto)" />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={44}
          domain={['auto', 'auto']}
          tickFormatter={(v: number) => integer(v)}
        />
        <Tooltip
          {...TOOLTIP_PROPS}
          cursor={{ stroke: 'var(--borde-activo)' }}
          formatter={(v) => [series.format(Number(v)), series.title]}
        />
        <Line
          type="monotone"
          dataKey="v"
          stroke="var(--oceano)"
          strokeWidth={2}
          dot={{ r: 4, fill: 'var(--oceano)', stroke: 'var(--asfalto)', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartFigure>
  )
}

/** The most reps done at one weight (ties go to the heavier weight). */
function bestRepsAtWeight(marks: PersonalRecords): { weight: number; reps: number } | null {
  let best: { weight: number; reps: number } | null = null
  for (const [weight, reps] of marks.repsAtWeight) {
    if (!best || reps > best.reps || (reps === best.reps && weight > best.weight))
      best = { weight, reps }
  }
  return best
}

function Records({
  marks,
  trackingType,
  unit,
}: {
  marks: PersonalRecords
  trackingType: TrackingType
  unit: WeightUnit
}) {
  const cards: { label: string; value: string }[] = []
  if (trackingType === 'weight_reps') {
    const atWeight = bestRepsAtWeight(marks)
    cards.push(
      { label: 'Peso máximo', value: formatWeight(marks.maxWeight, unit) },
      {
        label: 'Mejor 1RM estimado',
        value: marks.bestE1rm ? formatWeight(marks.bestE1rm, unit) : '—',
      },
      {
        label: 'Más reps con un peso',
        value: atWeight ? `${formatWeight(atWeight.weight, unit)} × ${atWeight.reps}` : '—',
      },
      { label: 'Mejor volumen en una sesión', value: formatVolume(marks.bestSessionVolume, unit) },
    )
  } else if (trackingType === 'reps') {
    cards.push(
      { label: 'Más reps en una serie', value: `${marks.maxReps} reps` },
      {
        label: 'Mayor lastre',
        value: marks.maxAddedLoad ? `+${formatWeight(marks.maxAddedLoad, unit)}` : '—',
      },
    )
  } else {
    cards.push({ label: 'Mayor duración', value: formatDuration(marks.maxDuration) })
  }
  return (
    <section aria-labelledby="exercise-records" className="flex flex-col gap-2">
      <h2 id="exercise-records" className="font-display text-xl uppercase">
        Récords
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {cards.map((c) => (
          <KpiCard key={c.label} label={c.label} value={c.value} />
        ))}
      </div>
    </section>
  )
}

/** Best set of a session for the history line. */
function bestSet(sets: WorkoutSet[], trackingType: TrackingType): WorkoutSet | undefined {
  const score = (s: WorkoutSet) =>
    trackingType === 'time'
      ? (s.durationSec ?? 0)
      : trackingType === 'reps'
        ? (s.reps ?? 0) * 1000 + (s.weight ?? 0)
        : (s.weight ?? 0) * 1000 + (s.reps ?? 0)
  return sets.reduce<WorkoutSet | undefined>(
    (a, b) => (!a || score(b) > score(a) ? b : a),
    undefined,
  )
}

const ALL = ''

/** V11 · Detalle de ejercicio: trend charts, records and every session, filterable by routine. */
export function ExerciseDetail() {
  const { exerciseId = '' } = useParams()
  const data = useProgressData()
  const { byId } = useExerciseLookup()
  const [routineFilter, setRoutineFilter] = useState<Id>(ALL)
  const selectId = useId()

  const exercise = byId.get(exerciseId)
  const title = exercise?.name ?? 'Ejercicio'
  const header = <PageHeader title={title} leading={<BackLink to="/progreso" />} />
  if (!data) return header

  const { tables, settings } = data
  const trackingType = exercise?.trackingType ?? 'weight_reps'
  const all = exerciseSessions(exerciseId, tables)
  const workoutById = new Map(tables.workouts.map((w) => [w.id, w]))
  const routineLabel = (workoutId: Id) => {
    const w = workoutById.get(workoutId)
    if (!w) return ''
    if (!w.routineId) return w.name || 'Entreno libre'
    return w.routineDeleted ? `${w.name} (eliminada)` : w.name
  }

  // One option per routine the exercise was done in, named as in its latest session.
  const routines = new Map<Id, string>()
  for (const s of all) if (s.routineId) routines.set(s.routineId, routineLabel(s.workoutId))

  const filter = routines.has(routineFilter) ? routineFilter : ALL
  const sessions = filter === ALL ? all : all.filter((s) => s.routineId === filter)
  const points = exerciseSessionPoints(sessions, trackingType)
  const marks = personalRecords(sessions, trackingType)

  if (points.length === 0) {
    return (
      <>
        {header}
        <div className="flex flex-col gap-2 rounded-xl border border-concreto bg-asfalto px-4 py-6 text-center">
          <p className="font-bold">Aún no has registrado este ejercicio</p>
          <p className="text-polvo">
            Cuando completes series de {title} verás aquí su evolución y tus récords.
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      {header}
      <div className="flex flex-col gap-4 pb-6">
        {routines.size > 0 && (
          <div className="flex flex-col gap-2">
            <label htmlFor={selectId} className="text-sm text-polvo">
              Solo en rutina
            </label>
            <select
              id={selectId}
              value={filter}
              onChange={(e) => setRoutineFilter(e.target.value)}
              className="min-h-12 rounded-lg border border-concreto bg-asfalto px-3 text-arena"
            >
              <option value={ALL}>Todas las rutinas</option>
              {[...routines].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        {seriesFor(trackingType, settings.unit).map((s) => (
          <TrendChart key={s.title} series={s} points={points} />
        ))}

        {marks && <Records marks={marks} trackingType={trackingType} unit={settings.unit} />}

        <section aria-labelledby="exercise-history" className="flex flex-col gap-2">
          <h2 id="exercise-history" className="font-display text-xl uppercase">
            Historial
          </h2>
          <ul className="flex flex-col gap-2">
            {[...points].reverse().map((p) => {
              const best = bestSet(p.sets, trackingType)
              return (
                <li key={p.workoutId}>
                  <Link
                    to={`/historial/sesiones/${p.workoutId}`}
                    className="flex flex-col gap-1 rounded-xl border border-concreto bg-asfalto px-4 py-3"
                  >
                    <span className="flex justify-between gap-2">
                      <span className="font-bold">{shortDate(p.startedAt)}</span>
                      <span className="truncate text-sm text-polvo">
                        {routineLabel(p.workoutId)}
                      </span>
                    </span>
                    <span className="text-sm text-polvo">
                      {[
                        `${p.sets.length} ${p.sets.length === 1 ? 'serie' : 'series'}`,
                        best ? `mejor ${setText(best, trackingType, settings.unit)}` : null,
                        p.e1rm != null && trackingType === 'weight_reps'
                          ? `1RM est. ${formatWeight(p.e1rm, settings.unit)}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </>
  )
}
