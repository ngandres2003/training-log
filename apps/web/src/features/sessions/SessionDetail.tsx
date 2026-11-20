import type { WeightUnit } from '@training-log/domain'
import { Pencil, Repeat, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PageHeader } from '../../app/PageHeader'
import { deleteWorkout } from '../../data/repositories/workouts'
import { Button } from '../../ui/Button'
import { formatLongDayYear } from '../history/format'
import { BackLink } from '../routines/components/BackLink'
import { ConfirmSheet } from '../routines/components/Sheet'
import { dayOf } from '../routines/format'
import { fullSet } from '../workout/format'
import { openWorkout } from '../workout/ui-store'
import type { ExerciseModel } from '../workout/view-model'
import { SensationsView } from './Sensations'
import { repeatWorkout } from './session-actions'
import { sessionTitle, summarize } from './session-data'
import { SessionSummary } from './SessionSummary'
import { useSession } from './use-session'

function ExerciseSets({ exercise, unit }: { exercise: ExerciseModel; unit: WeightUnit }) {
  const titleId = useId()
  const done = exercise.sets.filter((s) => s.set.completed)
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2 rounded-xl border border-concreto bg-asfalto px-4 py-3">
      <h2 id={titleId} className="font-bold">
        {exercise.name}
      </h2>
      {exercise.we.note && <p className="text-sm text-polvo">Nota: {exercise.we.note}</p>}
      {done.length === 0 ? (
        <p className="text-sm text-polvo">Sin series completadas.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {done.map((s) => (
            <li key={s.set.id} className="flex items-center gap-3">
              <span className="w-6 text-center font-display text-polvo">{s.label}</span>
              <span className="flex-1">
                {fullSet(s.set, exercise.trackingType, unit)}
                {s.set.rpe != null && <span className="text-polvo"> · RPE {String(s.set.rpe).replace('.', ',')}</span>}
              </span>
              {s.pr && (
                <span className="text-xs font-bold text-atardecer">
                  <span>PR</span>
                  <span className="sr-only">, marca personal</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * V8 · Detalle de sesión: V7's summary read-only, sensations, note and each exercise with its
 * sets; Editar, Repetir and Eliminar. Records are derived (KTD7), so edits and deletes update
 * PRs and metrics everywhere (R26).
 */
export function SessionDetail() {
  const { workoutId = '' } = useParams()
  const { data, model, lookup } = useSession(workoutId)
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const back = <BackLink to="/historial" />

  if (data === undefined || (data && !model)) return <PageHeader title="Sesión" leading={back} />
  if (data === null || !model) {
    return (
      <>
        <PageHeader title="Sesión" leading={back} />
        <p className="text-polvo">Esta sesión ya no existe.</p>
      </>
    )
  }

  const { workout } = data
  const unit = model.settings.unit
  const summary = summarize(data, model, lookup)

  const repeat = async () => {
    await repeatWorkout(workout.id)
    openWorkout()
  }

  const remove = async () => {
    setConfirmDelete(false)
    await deleteWorkout(workout.id)
    void navigate('/historial', { replace: true })
  }

  return (
    <>
      <PageHeader
        title={sessionTitle(data)}
        leading={back}
        actions={
          <Link
            to="editar"
            aria-label="Editar"
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg text-arena"
          >
            <Pencil aria-hidden="true" className="size-5" />
          </Link>
        }
      />
      <div className="flex flex-col gap-4">
        <p className="text-polvo first-letter:uppercase">{formatLongDayYear(dayOf(workout.startedAt))}</p>
        <SessionSummary summary={summary} unit={unit} />
        <SensationsView value={workout} rpe={summary.rpe} />
        {model.exercises.map((e) => (
          <ExerciseSets key={e.we.id} exercise={e} unit={unit} />
        ))}
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => void repeat()}>
            <Repeat aria-hidden="true" className="size-5" />
            Repetir
          </Button>
          <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden="true" className="size-5" />
            Eliminar
          </Button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmSheet
          title="¿Eliminar sesión?"
          description="Se quitará del historial y se recalcularán tus récords y métricas."
          confirmLabel="Eliminar"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  )
}
