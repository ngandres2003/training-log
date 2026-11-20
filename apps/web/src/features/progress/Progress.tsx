import {
  averageSensation,
  exerciseSessionPoints,
  exerciseSessions,
  featuredExercises,
  movementBalance,
  muscleSets,
  periodRanges,
  progressKpis,
  progressSessions,
  recordEvents,
  weekStartOf,
  weeklyFrequency,
  weeklyVolume,
  weeksIn,
  type ExerciseSessionPoint,
  type Kpi,
  type ProgressPeriod,
  type TrackingType,
} from '@training-log/domain'
import { useState } from 'react'
import { PageHeader } from '../../app/PageHeader'
import { ChoiceGroup } from '../../ui/ChoiceGroup'
import { useExerciseLookup } from '../exercises/catalog'
import { decimal1, deviceTimeZone, todayKey } from '../routines/format'
import { FeaturedExercises, type FeaturedItem } from './FeaturedExercises'
import { formatVolume, integer, signed } from './format'
import { FrequencyChart } from './FrequencyChart'
import { KpiCard, trendOf } from './KpiCard'
import { useProgressData } from './load'
import { MuscleMap } from './MuscleMap'
import { MovementBalance, MuscleSets } from './MuscleSets'
import { RecentRecords } from './RecentRecords'
import { VolumeChart } from './VolumeChart'

const PERIODS = [
  { value: '4w', label: '4 sem' },
  { value: '3m', label: '3 meses' },
  { value: '1y', label: '1 año' },
  { value: 'all', label: 'Todo' },
] as const satisfies readonly { value: ProgressPeriod; label: string }[]

/** The value a mini curve or headline follows for each tracking type. */
export function headlineValue(p: ExerciseSessionPoint, trackingType: TrackingType): number | null {
  if (trackingType === 'time') return p.maxDuration
  if (trackingType === 'reps') return p.maxReps
  return p.e1rm
}

const RECENT_RECORDS = 5

/** V10 · Progreso: period selector, KPIs, charts, muscle map, recent records and featured exercises. */
export function Progress() {
  const data = useProgressData()
  const { byId } = useExerciseLookup()
  const [period, setPeriod] = useState<ProgressPeriod>('4w')

  if (!data) return <PageHeader title="Progreso" />

  const { tables, settings } = data
  const timeZone = deviceTimeZone()
  const sessions = progressSessions(tables, timeZone)

  if (sessions.length === 0) {
    return (
      <>
        <PageHeader title="Progreso" />
        <div className="flex flex-col gap-2 rounded-xl border border-concreto bg-asfalto px-4 py-6 text-center">
          <p className="font-bold">Aún no hay progreso que mostrar</p>
          <p className="text-polvo">
            Completa tu primer entreno y aquí verás tus entrenos, volumen, músculos trabajados y
            récords.
          </p>
        </div>
      </>
    )
  }

  const lookup = (id: string) => byId.get(id)
  const trackingOf = (id: string): TrackingType => byId.get(id)?.trackingType ?? 'weight_reps'
  const today = todayKey()
  const ranges = periodRanges(period, today, sessions[0]!.day)
  const { current } = ranges
  const inPeriod = sessions.filter((s) => s.day >= current.from && s.day <= current.to)
  // Trend lines need at least two sessions (U17 approach 5).
  const showTrends = sessions.length >= 2

  const kpis = progressKpis(sessions, lookup, ranges)
  const sensation = averageSensation({
    workouts: inPeriod,
    sets: inPeriod.flatMap((s) => s.exercises.flatMap((e) => e.sets)),
  })

  const perWeekMuscles = new Map(
    [...muscleSets(sessions, lookup, current)].map(
      ([id, n]) => [id, n / weeksIn(current)] as const,
    ),
  )
  const thisWeek = { from: weekStartOf(today, settings.weekStart), to: today }

  const records = recordEvents(sessions, lookup)
    .filter((ev) => {
      const day = sessions.find((s) => s.workoutId === ev.workoutId)?.day ?? ''
      return day >= current.from && day <= current.to
    })
    .slice(0, RECENT_RECORDS)

  const featured: FeaturedItem[] = featuredExercises(sessions, current).map(
    ({ exerciseId, sets }) => {
      const tracking = trackingOf(exerciseId)
      const points = exerciseSessionPoints(exerciseSessions(exerciseId, tables), tracking).filter(
        (p) => inPeriod.some((s) => s.workoutId === p.workoutId),
      )
      return {
        exerciseId,
        sets,
        name: byId.get(exerciseId)?.name ?? 'Ejercicio',
        curve: points.flatMap((p) => {
          const v = headlineValue(p, tracking)
          return v == null ? [] : [v]
        }),
      }
    },
  )

  const kpiCard = (label: string, kpi: Kpi, format: (n: number) => string) => (
    <KpiCard
      label={label}
      value={kpi.value == null ? '—' : format(kpi.value)}
      delta={kpi.delta == null ? null : signed(kpi.delta, format)}
      trend={trendOf(kpi.delta)}
    />
  )

  return (
    <>
      <PageHeader title="Progreso" />
      <div className="flex flex-col gap-4 pb-6">
        <ChoiceGroup label="Periodo" choices={PERIODS} value={period} onChange={setPeriod} />

        <section aria-label="Indicadores" className="grid grid-cols-2 gap-2">
          {kpiCard('Entrenos', kpis.workouts, integer)}
          {kpiCard('Volumen total', kpis.volume, (n) => formatVolume(n, settings.unit))}
          {kpiCard('Duración media', kpis.avgMinutes, (n) => `${integer(n)} min`)}
          {kpiCard('Series totales', kpis.sets, integer)}
          {sensation.energy != null && (
            <KpiCard label="Energía media" value={`${decimal1(sensation.energy)}/5`} />
          )}
          {sensation.rpe != null && <KpiCard label="RPE medio" value={decimal1(sensation.rpe)} />}
        </section>

        {showTrends && (
          <>
            <VolumeChart
              data={weeklyVolume(sessions, lookup, current, settings.weekStart)}
              unit={settings.unit}
            />
            <FrequencyChart
              data={weeklyFrequency(sessions, current, settings.weekStart)}
              goal={settings.weeklyGoal}
            />
          </>
        )}

        <MuscleSets perWeek={perWeekMuscles} />
        <MovementBalance balance={movementBalance(sessions, lookup, current)} />
        <MuscleMap sets={muscleSets(sessions, lookup, thisWeek)} />
        <RecentRecords events={records} byId={byId} unit={settings.unit} />
        <FeaturedExercises items={featured} />
      </div>
    </>
  )
}
