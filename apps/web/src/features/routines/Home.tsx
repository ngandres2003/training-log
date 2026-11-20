import {
  suggestToday,
  weekStartOf,
  weeklyStreak,
  type Folder,
  type Id,
  type Routine,
  type RoutineExercise,
} from '@training-log/domain'
import { useLiveQuery } from 'dexie-react-hooks'
import { Flame, Play } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { PageHeader } from '../../app/PageHeader'
import { listFolders } from '../../data/repositories/folders'
import {
  archiveRoutine,
  deleteRoutine,
  listInicioRoutines,
  listRoutineExercises,
  updateRoutine,
} from '../../data/repositories/routines'
import { DEFAULT_SETTINGS, getSettings } from '../../data/repositories/settings'
import { getActiveWorkout, listWorkouts } from '../../data/repositories/workouts'
import { Button } from '../../ui/Button'
import { useExerciseLookup } from '../exercises/catalog'
import { TipCard } from '../tips/TipCard'
import { ConfirmSheet, Sheet } from './components/Sheet'
import { FolderSection } from './FolderSection'
import { dayOf, todayKey, workoutMinutes } from './format'
import { RoutineCard, type RoutineCardInfo } from './RoutineCard'
import { duplicateRoutine } from './routine-ops'
import { onStartRoutine } from './start-workout'
import { TodaySuggestion } from './TodaySuggestion'
import { WeekRing } from './WeekRing'
import { WeekStrip } from './WeekStrip'

/** Navigation state set by the editor after saving a new routine (spec F1 step 5). */
export interface HomeLocationState {
  savedRoutineId?: Id
}

async function loadHome() {
  const [folders, routines, workouts, active, settings] = await Promise.all([
    listFolders(),
    listInicioRoutines(),
    listWorkouts(),
    getActiveWorkout(),
    getSettings(),
  ])
  const exercises = new Map<Id, RoutineExercise[]>(
    await Promise.all(routines.map(async (r) => [r.id, await listRoutineExercises(r.id)] as const)),
  )
  return { folders, routines, workouts, active, settings: settings ?? DEFAULT_SETTINGS, exercises }
}

const dateFormat = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

/** V1 · Inicio: header with streak and weekly goal, week strip, CTAs, "Toca hoy" and the routine feed. */
export function Home() {
  const navigate = useNavigate()
  const location = useLocation()
  const savedRoutineId = (location.state as HomeLocationState | null)?.savedRoutineId
  const data = useLiveQuery(loadHome, [])
  const { byId } = useExerciseLookup()
  const [moving, setMoving] = useState<Routine | null>(null)
  const [deleting, setDeleting] = useState<Routine | null>(null)
  const [confirmingEmpty, setConfirmingEmpty] = useState(false)
  const [message, setMessage] = useState('')

  if (!data) return <PageHeader title="Inicio" />

  const { folders, routines, workouts, active, settings, exercises } = data
  const finished = workouts.filter((w) => w.status === 'finished')
  const today = todayKey()
  const weekStart = weekStartOf(today, settings.weekStart)
  const trainedDays = finished.map((w) => dayOf(w.startedAt))
  const trainedThisWeek = new Set(trainedDays.filter((d) => d >= weekStart && d <= today))
  const streak = weeklyStreak({ trainedDays, today, weekStart: settings.weekStart, weeklyGoal: settings.weeklyGoal })
  const suggestion = suggestToday({ folders, routines, workouts })
  const saved = savedRoutineId ? routines.find((r) => r.id === savedRoutineId) : undefined

  function cardInfo(routine: Routine): RoutineCardInfo {
    const done = finished.filter((w) => w.routineId === routine.id)
    const minutes = done.flatMap((w) => {
      const m = workoutMinutes(w)
      return m == null ? [] : [m]
    })
    return {
      routine,
      exerciseNames: (exercises.get(routine.id) ?? []).map((e) => byId.get(e.exerciseId)?.name ?? 'Ejercicio'),
      lastDoneAt: done[0]?.startedAt ?? null, // listWorkouts is newest first
      avgMinutes: minutes.length ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length) : null,
    }
  }

  async function act(fn: () => Promise<unknown>, done: string) {
    await fn()
    setMessage(done)
  }

  function renderCard(info: RoutineCardInfo, position?: number, extra?: ReactNode) {
    const r = info.routine
    return (
      <RoutineCard
        key={r.id}
        info={info}
        position={position}
        highlighted={r.id === savedRoutineId}
        extra={extra}
        onStart={() => void onStartRoutine(r.id)}
        menu={[
          { label: 'Editar', onSelect: () => void navigate(`rutinas/${r.id}/editar`) },
          { label: 'Duplicar', onSelect: () => void act(() => duplicateRoutine(r.id), `«${r.name}» duplicada`) },
          { label: 'Mover a carpeta', onSelect: () => setMoving(r) },
          { label: 'Archivar', onSelect: () => void act(() => archiveRoutine(r.id), `«${r.name}» archivada`) },
          { label: 'Eliminar', onSelect: () => setDeleting(r), destructive: true },
        ]}
      />
    )
  }

  const byFolder = (f: Folder) => routines.filter((r) => r.folderId === f.id)
  const folderIds = new Set(folders.map((f) => f.id))
  const unfiled = routines.filter((r) => !r.folderId || !folderIds.has(r.folderId))

  return (
    <>
      <PageHeader title="Inicio" />
      <div className="flex flex-col gap-5">
        <section aria-label="Tu semana" className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold">{settings.displayName ? `Hola, ${settings.displayName}` : 'Hola'}</p>
              <p className="text-sm text-polvo first-letter:uppercase">{dateFormat.format(new Date())}</p>
              <p className="mt-1 flex items-center gap-1 text-sm">
                <Flame aria-hidden="true" className="size-4 text-sol" />
                Racha: {streak.current} {streak.current === 1 ? 'semana' : 'semanas'}
              </p>
            </div>
            <WeekRing done={trainedThisWeek.size} goal={settings.weeklyGoal} />
          </div>
          <WeekStrip weekStart={weekStart} today={today} trained={trainedThisWeek} />
        </section>

        {active && (
          <button
            type="button"
            onClick={() => void onStartRoutine(active.routineId)}
            className="flex min-h-12 items-center gap-3 rounded-xl bg-sol px-4 py-3 text-left font-bold text-tinta"
          >
            <Play aria-hidden="true" className="size-5 fill-current" />
            <span className="flex-1">Continuar entreno · {active.name}</span>
          </button>
        )}

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmingEmpty(true)}>
            Empezar entreno vacío
          </Button>
          <Link
            to="rutinas/nueva"
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg bg-sol px-4 font-bold text-tinta"
          >
            Nueva rutina
          </Link>
        </div>

        <TipCard />

        {suggestion && <TodaySuggestion routine={suggestion} onStart={() => void onStartRoutine(suggestion.id)} />}

        <section aria-labelledby="mis-rutinas" className="flex flex-col gap-4">
          <h2 id="mis-rutinas" className="font-display text-2xl uppercase">
            Mis rutinas
          </h2>
          {routines.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-concreto px-4 py-8 text-center">
              <span aria-hidden="true" className="font-display text-5xl text-concreto">
                ✚
              </span>
              <p className="font-bold">Crea tu primera rutina</p>
              <p className="text-sm text-polvo">Toca «Nueva rutina» y añade tus ejercicios.</p>
            </div>
          )}
          {folders.map((f) => (
            <FolderSection key={f.id} folder={f} cards={byFolder(f).map(cardInfo)} renderCard={renderCard} />
          ))}
          {unfiled.length > 0 && (
            <div className="flex flex-col gap-2">
              {folders.length > 0 && <h3 className="font-display text-xl text-polvo uppercase">Sin carpeta</h3>}
              {unfiled.map((r) => renderCard(cardInfo(r)))}
            </div>
          )}
          <Link to="rutinas/archivadas" className="inline-flex min-h-12 items-center text-polvo underline">
            Rutinas archivadas
          </Link>
        </section>
      </div>

      <p role="status" className="sr-only">
        {saved ? `Rutina «${saved.name}» guardada` : message}
      </p>

      {moving && (
        <Sheet title={`Mover «${moving.name}» a carpeta`}>
          <div className="flex flex-col gap-2">
            {[{ id: null, name: 'Sin carpeta' }, ...folders].map((f) => (
              <Button
                key={f.id ?? 'none'}
                variant={moving.folderId === f.id ? 'primary' : 'secondary'}
                aria-pressed={moving.folderId === f.id}
                onClick={() => {
                  const r = moving
                  setMoving(null)
                  void act(() => updateRoutine(r.id, { folderId: f.id }), `«${r.name}» movida a ${f.name}`)
                }}
              >
                {f.name}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => setMoving(null)}>
              Cancelar
            </Button>
          </div>
        </Sheet>
      )}

      {confirmingEmpty && (
        <ConfirmSheet
          tone="primary"
          title="¿Empezar entreno vacío?"
          description="Empiezas sin rutina y añades los ejercicios sobre la marcha."
          confirmLabel="Empezar"
          onCancel={() => setConfirmingEmpty(false)}
          onConfirm={() => {
            setConfirmingEmpty(false)
            void onStartRoutine(null)
          }}
        />
      )}

      {deleting && (
        <ConfirmSheet
          title={`¿Eliminar «${deleting.name}»?`}
          description={`Se borra la plantilla. Sus sesiones se conservan en Historial y Progreso como «${deleting.name} (eliminada)».`}
          confirmLabel="Eliminar"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const r = deleting
            setDeleting(null)
            void act(() => deleteRoutine(r.id), `«${r.name}» eliminada`)
          }}
        />
      )}
    </>
  )
}
