import type { Id, WeightUnit } from '@training-log/domain'
import { Ellipsis, Plus } from 'lucide-react'
import { forwardRef, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../ui/Button'
import { ExerciseThumb, muscleLabel } from '../exercises/ExerciseRow'
import { ConfirmSheet, Sheet } from '../routines/components/Sheet'
import { ActionMenu, type ActionItem } from './components/ActionMenu'
import { OtherRoutineChip } from './OtherRoutineChip'
import { RestSetting } from './RestSetting'
import { fieldsFor, SetRow } from './SetRow'
import { SupersetGroup } from './SupersetGroup'
import { alternation, type BlockModel, type ExerciseModel, type SetModel } from './view-model'
import type { SetPatch } from './workout-actions'

export interface ExerciseBlockHandlers {
  onComplete: (exercise: ExerciseModel, set: SetModel, values: SetPatch) => void
  onSave: (setId: Id, patch: SetPatch) => void
  onUncomplete: (setId: Id) => void
  onDeleteSet: (setId: Id) => void
  onAddSet: (workoutExerciseId: Id) => void
  onReplace: (workoutExerciseId: Id) => void
  onRemove: (workoutExerciseId: Id) => void
  onToggleSuperset: (workoutExerciseId: Id) => void
  onSaveNote: (workoutExerciseId: Id, note: string) => void
  /** Rest of the exercise (null = none); absent where it cannot change. */
  onSaveRest?: (workoutExerciseId: Id, restSec: number | null) => void
}

function ExerciseHeader({
  exercise,
  unit,
  canGroupWithNext,
  handlers,
}: {
  exercise: ExerciseModel
  unit: WeightUnit
  canGroupWithNext: boolean
  handlers: ExerciseBlockHandlers
}) {
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState(exercise.we.note)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const { we, exercise: ex } = exercise
  const muscles = ex ? [ex.primaryMuscle, ...ex.secondaryMuscles].map(muscleLabel).join(', ') : ''

  const items: ActionItem[] = [
    { label: 'Reemplazar ejercicio', onSelect: () => handlers.onReplace(we.id) },
    {
      label: 'Nota de hoy',
      onSelect: () => {
        setNote(we.note)
        setNoteOpen(true)
      },
    },
  ]
  if (we.supersetGroup) items.push({ label: 'Quitar de la superserie', onSelect: () => handlers.onToggleSuperset(we.id) })
  else if (canGroupWithNext)
    items.push({ label: 'Superserie con el siguiente', onSelect: () => handlers.onToggleSuperset(we.id) })
  items.push({ label: 'Quitar ejercicio', destructive: true, onSelect: () => setConfirmRemove(true) })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        {ex && <ExerciseThumb exercise={ex} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            to={`/progreso/ejercicios/${we.exerciseId}`}
            className="line-clamp-2 min-h-6 text-lg leading-tight font-bold break-words"
          >
            {exercise.letter && <span className="mr-1 font-display text-sol">{exercise.letter}</span>}
            {exercise.name}
          </Link>
          {muscles && <span className="truncate text-sm text-polvo">{muscles}</span>}
          <RestSetting
            exerciseName={exercise.name}
            restSec={exercise.restSec}
            onSave={handlers.onSaveRest && ((restSec) => handlers.onSaveRest!(we.id, restSec))}
          />
        </div>
        <ActionMenu label={`Opciones de ${exercise.name}`} items={items} className="text-polvo">
          <Ellipsis aria-hidden="true" className="size-6" />
        </ActionMenu>
      </div>
      {exercise.fixedNote && <p className="text-sm text-polvo">{exercise.fixedNote}</p>}
      {we.note && <p className="text-sm text-arena">Hoy: {we.note}</p>}
      {exercise.chip && exercise.chipNames && (
        <OtherRoutineChip
          chip={exercise.chip}
          names={exercise.chipNames}
          exerciseId={we.exerciseId}
          trackingType={exercise.trackingType}
          unit={unit}
        />
      )}

      {noteOpen && (
        <Sheet title="Nota de hoy">
          <label className="flex flex-col gap-1 text-sm text-polvo">
            Nota para {exercise.name}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="rounded-lg border border-concreto bg-hierro p-3 text-base text-arena"
            />
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setNoteOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                handlers.onSaveNote(we.id, note.trim())
                setNoteOpen(false)
              }}
            >
              Guardar
            </Button>
          </div>
        </Sheet>
      )}
      {confirmRemove && (
        <ConfirmSheet
          title="¿Quitar ejercicio?"
          description={`Se quitará ${exercise.name} y sus series de este entreno.`}
          confirmLabel="Quitar"
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => {
            setConfirmRemove(false)
            handlers.onRemove(we.id)
          }}
        />
      )}
    </div>
  )
}

/**
 * One carousel slide (design: ~350 px, the neighbour peeks ~12 px, vertical scroll only inside).
 * A superset is one slide whose rows alternate A1 → B1 → A2 (R20).
 */
export const ExerciseBlock = forwardRef<
  HTMLElement,
  {
    block: BlockModel
    position: number
    count: number
    unit: WeightUnit
    /** Ids of all exercises in workout order, to know whether one can be grouped with the next. */
    hasNextExercise: (workoutExerciseId: Id) => boolean
    handlers: ExerciseBlockHandlers
    footer?: React.ReactNode
    /** Full-width card in a vertical list (V8's session editor) instead of a carousel slide. */
    stacked?: boolean
    /** The slide in view; the others recede a little. Defaults to true. */
    current?: boolean
  }
>(function ExerciseBlock(
  { block, position, count, unit, hasNextExercise, handlers, footer, stacked = false, current = true },
  ref,
) {
  const [activeSetId, setActiveSetId] = useState<Id | null>(null)
  const rows = alternation(block)
  const first = block.exercises[0]!
  const fields = fieldsFor(first.trackingType, unit)
  const name = block.superset
    ? `Superserie: ${block.exercises.map((e) => e.name).join(' · ')}`
    : first.name

  const headers = block.exercises.map((e) => (
    <ExerciseHeader
      key={e.we.id}
      exercise={e}
      unit={unit}
      canGroupWithNext={hasNextExercise(e.we.id)}
      handlers={handlers}
    />
  ))

  const table = (
    <table className="w-full table-fixed border-separate border-spacing-y-1 text-arena">
      <thead>
        <tr className="text-xs text-polvo uppercase">
          <th scope="col" className="w-12 font-medium">
            Serie
          </th>
          <th scope="col" className="w-20 text-left font-medium">
            Anterior
          </th>
          {fields.map((f) => (
            <th key={f.key} scope="col" className={`font-medium ${f.key === 'rpe' ? 'w-12' : ''}`}>
              {f.header}
            </th>
          ))}
          <th scope="col" className="w-12 font-medium">
            <span aria-hidden="true">✓</span>
            <span className="sr-only">Hecha</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ exercise, set }) => {
          const rowName = exercise.letter ? `${exercise.letter}${set.index + 1}` : String(set.index + 1)
          const label = exercise.letter ? rowName : set.label
          return (
            <SetRow
              key={set.set.id}
              model={set}
              trackingType={exercise.trackingType}
              unit={unit}
              rowName={rowName}
              label={label}
              active={activeSetId === set.set.id}
              onActivate={() => setActiveSetId(set.set.id)}
              onSave={(patch) => handlers.onSave(set.set.id, patch)}
              onComplete={(values) => {
                setActiveSetId(null)
                handlers.onComplete(exercise, set, values)
              }}
              onUncomplete={() => handlers.onUncomplete(set.set.id)}
              onDelete={() => handlers.onDeleteSet(set.set.id)}
            />
          )
        })}
      </tbody>
    </table>
  )

  const addButtons = block.exercises.map((e) => (
    <Button
      key={e.we.id}
      variant="ghost"
      className="w-full border border-dashed border-borde-activo text-arena uppercase hover:bg-concreto/40"
      onClick={() => handlers.onAddSet(e.we.id)}
    >
      <Plus aria-hidden="true" className="size-5" />
      {block.superset ? `Añadir serie ${e.letter}` : 'Añadir serie'}
    </Button>
  ))

  return (
    <section
      ref={ref}
      role="group"
      aria-roledescription={stacked ? undefined : 'diapositiva'}
      aria-label={`${name} (${position} de ${count})`}
      className={`flex flex-col gap-3 rounded-2xl border bg-asfalto p-3 transition-[opacity,transform,border-color,box-shadow] duration-300 ease-suave ${
        stacked
          ? 'w-full border-borde-fuerte'
          : `scrollbar-none max-h-full w-[calc(100%-1.75rem)] shrink-0 snap-center overflow-y-auto ${
              current
                ? 'border-borde-activo shadow-[0_6px_24px_rgb(0_0_0/0.08)]'
                : 'scale-[0.96] border-borde-fuerte opacity-50'
            }`
      }`}
    >
      {block.superset ? (
        <SupersetGroup>
          {headers}
          {table}
        </SupersetGroup>
      ) : (
        <>
          {headers}
          {table}
        </>
      )}
      <div className="flex flex-col gap-2">{addButtons}</div>
      {footer && <div className="flex justify-center border-t border-concreto pt-2">{footer}</div>}
    </section>
  )
})
