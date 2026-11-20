import {
  averageSensation,
  formatWeight,
  totalVolume,
  type Id,
  type TrackingType,
  type Workout,
  type WorkoutSet,
} from '@training-log/domain'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Play } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { Link, useParams } from 'react-router'
import { PageHeader } from '../../app/PageHeader'
import { getRoutine, listRoutineExercises, listRoutineSets } from '../../data/repositories/routines'
import { DEFAULT_SETTINGS, getSettings } from '../../data/repositories/settings'
import { listWorkoutExercises, listWorkoutSets, listWorkouts } from '../../data/repositories/workouts'
import { useExerciseLookup } from '../exercises/catalog'
import { BackLink } from './components/BackLink'
import { decimal1, shortDate, targetSummary, workoutMinutes } from './format'
import { onStartRoutine } from './start-workout'

async function loadDetail(routineId: Id) {
  const routine = await getRoutine(routineId)
  if (!routine) return { routine: null } as const
  const settings = (await getSettings()) ?? DEFAULT_SETTINGS
  const exercises = await Promise.all(
    (await listRoutineExercises(routineId)).map(async (e) => ({ ...e, sets: await listRoutineSets(e.id) })),
  )
  const workouts = (await listWorkouts()).filter((w) => w.routineId === routineId && w.status === 'finished')
  const sessions = await Promise.all(
    workouts.map(async (w) => ({
      workout: w as Workout,
      exercises: await Promise.all(
        (await listWorkoutExercises(w.id)).map(async (e) => ({
          exerciseId: e.exerciseId,
          sets: await listWorkoutSets(e.id),
        })),
      ),
    })),
  )
  return { routine, settings, exercises, sessions } as const
}

const TABS = ['Ejercicios', 'Historial', 'Estadísticas'] as const
type Tab = (typeof TABS)[number]

interface SessionRow {
  workout: Workout
  minutes: number | null
  volume: number
  rpe: number | null
  sets: WorkoutSet[]
}

/** V2 · Detalle de rutina: header with ▶ Iniciar and the Ejercicios | Historial | Estadísticas tabs. */
export function RoutineDetail() {
  const { routineId = '' } = useParams()
  const data = useLiveQuery(() => loadDetail(routineId), [routineId])
  const { byId } = useExerciseLookup()
  const [tab, setTab] = useState<Tab>('Ejercicios')
  const baseId = useId()

  if (!data) return <PageHeader title="Rutina" leading={<BackLink to="/" />} />
  if (!data.routine) {
    return (
      <>
        <PageHeader title="Rutina" leading={<BackLink to="/" />} />
        <p className="text-polvo">Esta rutina ya no existe.</p>
      </>
    )
  }

  const { routine, settings, exercises, sessions } = data
  const trackingOf = (exerciseId: Id): TrackingType => byId.get(exerciseId)?.trackingType ?? 'weight_reps'

  const rows: SessionRow[] = sessions.map(({ workout, exercises: wex }) => {
    const sets = wex.flatMap((e) => e.sets)
    return {
      workout,
      sets,
      minutes: workoutMinutes(workout),
      volume: wex.reduce((sum, e) => sum + totalVolume(e.sets, trackingOf(e.exerciseId)), 0),
      rpe: averageSensation({ workouts: [], sets }).rpe,
    }
  })

  function onTabKey(e: KeyboardEvent, index: number) {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    const next = TABS[(index + delta + TABS.length) % TABS.length]!
    setTab(next)
    document.getElementById(`${baseId}-tab-${next}`)?.focus()
  }

  return (
    <>
      <PageHeader
        title={routine.name}
        leading={<BackLink to="/" />}
        actions={
          <Link
            to="editar"
            aria-label="Editar rutina"
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg text-arena"
          >
            <Pencil aria-hidden="true" className="size-5" />
          </Link>
        }
      />
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="mt-1 size-4 shrink-0 rounded-full" style={{ backgroundColor: routine.color }} />
          {routine.notes ? <p className="text-polvo">{routine.notes}</p> : <p className="text-polvo">Sin notas.</p>}
        </div>
        <button
          type="button"
          onClick={() => void onStartRoutine(routine.id)}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-sol px-4 font-display text-xl text-tinta uppercase"
        >
          <Play aria-hidden="true" className="size-5 fill-current" />
          Iniciar
        </button>

        <div role="tablist" aria-label="Secciones de la rutina" className="grid grid-cols-3 border-b border-concreto">
          {TABS.map((t, i) => (
            <button
              key={t}
              id={`${baseId}-tab-${t}`}
              type="button"
              role="tab"
              aria-selected={tab === t}
              aria-controls={`${baseId}-panel`}
              tabIndex={tab === t ? 0 : -1}
              onClick={() => setTab(t)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={`min-h-12 border-b-2 text-sm ${
                tab === t ? 'border-sol font-bold text-arena' : 'border-transparent text-polvo'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${tab}`}>
          {tab === 'Ejercicios' && (
            <ul className="flex flex-col gap-2">
              {exercises.length === 0 && <li className="text-polvo">Esta rutina no tiene ejercicios.</li>}
              {exercises.map((e) => (
                <li key={e.id} className="rounded-xl border border-concreto bg-asfalto px-4 py-3">
                  <p className="font-bold">{byId.get(e.exerciseId)?.name ?? 'Ejercicio'}</p>
                  <p className="text-sm text-polvo">{targetSummary(e.sets, trackingOf(e.exerciseId), settings.unit)}</p>
                  {e.note && <p className="text-sm text-polvo italic">{e.note}</p>}
                </li>
              ))}
            </ul>
          )}

          {tab === 'Historial' && (
            <ul className="flex flex-col gap-2">
              {rows.length === 0 && <li className="text-polvo">Aún no has hecho esta rutina.</li>}
              {rows.map((r) => (
                <li key={r.workout.id}>
                  <Link
                    to={`/historial/sesiones/${r.workout.id}`}
                    className="flex flex-col gap-1 rounded-xl border border-concreto bg-asfalto px-4 py-3"
                  >
                    <span className="font-bold">{shortDate(r.workout.startedAt)}</span>
                    <span className="text-sm text-polvo">
                      {[
                        r.minutes != null ? `${r.minutes} min` : null,
                        formatWeight(r.volume, settings.unit),
                        r.workout.energy != null ? `Energía ${r.workout.energy}/5` : null,
                        r.rpe != null ? `RPE ${decimal1(r.rpe)}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {r.workout.note && <span className="text-sm">{r.workout.note}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {tab === 'Estadísticas' && <Stats rows={rows} unit={settings.unit} />}
        </div>
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-concreto bg-asfalto px-4 py-3">
      <span className="text-sm text-polvo">{label}</span>
      <span className="font-display text-2xl">{value}</span>
    </div>
  )
}

function Stats({ rows, unit }: { rows: SessionRow[]; unit: typeof DEFAULT_SETTINGS.unit }) {
  if (rows.length === 0) return <p className="text-polvo">Aún no hay estadísticas: completa una sesión.</p>
  const minutes = rows.flatMap((r) => (r.minutes == null ? [] : [r.minutes]))
  const avgMinutes = minutes.length ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length) : null
  const best = rows.reduce((a, b) => (b.volume > a.volume ? b : a))
  const sensation = averageSensation({ workouts: rows.map((r) => r.workout), sets: rows.flatMap((r) => r.sets) })
  const chronological = [...rows].reverse()

  return (
    <div className="flex flex-col gap-3">
      <VolumeChart points={chronological.map((r) => r.volume)} />
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Veces realizada" value={String(rows.length)} />
        <Stat label="Duración media" value={avgMinutes != null ? `${avgMinutes} min` : '—'} />
        <Stat label="Mejor sesión" value={`${formatWeight(best.volume, unit)} · ${shortDate(best.workout.startedAt)}`} />
        <Stat label="Energía media" value={sensation.energy != null ? `${decimal1(sensation.energy)}/5` : '—'} />
        <Stat label="RPE medio" value={sensation.rpe != null ? decimal1(sensation.rpe) : '—'} />
      </div>
    </div>
  )
}

/** Volume per session as a simple line, oldest to newest. */
function VolumeChart({ points }: { points: number[] }) {
  if (points.length < 2) return null
  const w = 300
  const h = 100
  const max = Math.max(...points, 1)
  const coords = points
    .map((v, i) => `${(i / (points.length - 1)) * w},${h - (v / max) * (h - 8) - 4}`)
    .join(' ')
  return (
    <figure className="rounded-xl border border-concreto bg-asfalto p-3">
      <figcaption className="mb-2 text-sm text-polvo">Volumen por sesión</figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" role="img" aria-label={`Volumen de las últimas ${points.length} sesiones`}>
        <polyline points={coords} fill="none" strokeWidth="3" className="stroke-oceano" strokeLinejoin="round" />
      </svg>
    </figure>
  )
}
