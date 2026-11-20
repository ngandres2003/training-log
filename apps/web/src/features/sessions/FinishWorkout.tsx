import type { Id } from '@training-log/domain'
import { ChevronLeft } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '../../ui/Button'
import { Sheet } from '../routines/components/Sheet'
import { celebrate, closeFinish, closeWorkout } from '../workout/ui-store'
import { useNow } from '../workout/use-now'
import { discardWorkout } from '../workout/workout-actions'
import { RoutineChanges, type RoutineDecision } from './RoutineChanges'
import { SensationsEditor, type SensationValues } from './Sensations'
import { saveFinishedWorkout } from './session-actions'
import { routineChanges, summarize } from './session-data'
import { SessionSummary } from './SessionSummary'
import { useSession } from './use-session'

/**
 * V7 · Finalizar entreno (F3): summary and comparison with the last session of the routine,
 * sensations and note, "¿Actualizar la rutina?" (or "Guardar como rutina nueva" for a free
 * workout), then Guardar → celebration → V1, or Descartar with confirmation.
 */
export function FinishWorkout({ workoutId }: { workoutId: Id }) {
  const { data, model, lookup } = useSession(workoutId)
  const now = useNow()
  const nameId = useId()
  const [sensations, setSensations] = useState<SensationValues>({ energy: null, tags: [], note: '' })
  const [decision, setDecision] = useState<RoutineDecision>('once')
  const [asRoutine, setAsRoutine] = useState(false)
  const [routineName, setRoutineName] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!data || !model) return <div aria-hidden="true" className="fixed inset-0 z-40 bg-hierro" />

  const unit = model.settings.unit
  const summary = summarize(data, model, lookup, now)
  const changes = routineChanges(data)
  const free = data.workout.routineId === null
  const canSave = !saving && !(asRoutine && routineName.trim() === '')

  const save = async () => {
    setSaving(true)
    await saveFinishedWorkout({
      workoutId,
      ...sensations,
      note: sensations.note.trim(),
      updateRoutine: changes.length > 0 && decision === 'update',
      newRoutineName: free && asRoutine ? routineName.trim() : null,
    })
    celebrate(workoutId)
    closeWorkout()
  }

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Finalizar entreno"
        aria-hidden={confirmDiscard || undefined}
        className="fixed inset-0 z-40 flex justify-center bg-hierro text-arena"
      >
        <div className="flex h-full w-full max-w-[480px] flex-col">
          <header className="flex items-center gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1">
            <button
              type="button"
              aria-label="Volver al entreno"
              onClick={closeFinish}
              className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-lg text-arena"
            >
              <ChevronLeft aria-hidden="true" className="size-7" />
            </button>
            <div className="flex min-w-0 flex-1 flex-col">
              <h1 className="truncate font-display text-2xl leading-tight uppercase">Finalizar</h1>
              <span className="truncate text-sm text-polvo">{data.workout.name}</span>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-2">
            <SessionSummary summary={summary} unit={unit} />
            <SensationsEditor
              value={sensations}
              rpe={summary.rpe}
              onChange={(patch) => setSensations((s) => ({ ...s, ...patch }))}
            />
            {changes.length > 0 && (
              <RoutineChanges changes={changes} lookup={lookup} unit={unit} decision={decision} onDecide={setDecision} />
            )}
            {free && (
              <div className="flex flex-col gap-2">
                <Button variant="secondary" aria-pressed={asRoutine} onClick={() => setAsRoutine((v) => !v)}>
                  Guardar como rutina nueva
                </Button>
                {asRoutine && (
                  <>
                    <label htmlFor={nameId} className="text-sm text-polvo">
                      Nombre de la rutina
                    </label>
                    <input
                      id={nameId}
                      value={routineName}
                      onChange={(e) => setRoutineName(e.target.value)}
                      className="min-h-12 rounded-lg border border-concreto bg-asfalto px-3 text-arena"
                    />
                  </>
                )}
              </div>
            )}
          </div>

          <footer className="flex gap-2 border-t border-concreto px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <Button variant="ghost" onClick={() => setConfirmDiscard(true)}>
              Descartar
            </Button>
            <Button className="flex-1 uppercase" disabled={!canSave} onClick={() => void save()}>
              Guardar
            </Button>
          </footer>
        </div>
      </div>

      {confirmDiscard && (
        <Sheet title="¿Descartar entreno?" description="Se perderán las series de esta sesión." alert>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" autoFocus onClick={() => setConfirmDiscard(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1 !bg-[#e05d5d] !text-arena"
              onClick={() => {
                setConfirmDiscard(false)
                closeWorkout()
                void discardWorkout(workoutId)
              }}
            >
              Descartar
            </Button>
          </div>
        </Sheet>
      )}
    </>
  )
}
