import type { Exercise, Id } from '@training-log/domain'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { PageHeader } from '../../app/PageHeader'
import { nowIso } from '../../data/ids'
import { updateWorkout, updateWorkoutSet } from '../../data/repositories/workouts'
import { Button } from '../../ui/Button'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { BackLink } from '../routines/components/BackLink'
import { ExerciseBlock, type ExerciseBlockHandlers } from '../workout/ExerciseBlock'
import type { WorkoutModel } from '../workout/view-model'
import {
  addExercises,
  addSet,
  deleteSet,
  removeExercise,
  replaceExercise,
  saveExerciseNote,
  saveSet,
  toggleSuperset,
  uncompleteSet,
} from '../workout/workout-actions'
import { SensationsEditor, type SensationValues } from './Sensations'
import { summarize, type SessionData } from './session-data'
import { useSession } from './use-session'

type Picker = { kind: 'add' } | { kind: 'replace'; workoutExerciseId: Id }

function Editor({ data, model, lookup }: { data: SessionData; model: WorkoutModel; lookup: Map<Id, Exercise> }) {
  const { workout } = data
  const [sensations, setSensations] = useState<SensationValues>({
    energy: workout.energy,
    tags: workout.tags,
    note: workout.note,
  })
  const [picker, setPicker] = useState<Picker | null>(null)
  const summary = summarize(data, model, lookup)

  // Same rows as V5 (U13), writing straight to the finished workout. ✓ dates the set at the
  // session's end so the day and history order stay put; there is no rest timer here.
  const handlers: ExerciseBlockHandlers = {
    onComplete: (_exercise, set, values) =>
      void updateWorkoutSet(set.set.id, { ...values, completed: true, completedAt: workout.endedAt ?? nowIso() }),
    onSave: (setId, patch) => void saveSet(setId, patch),
    onUncomplete: (setId) => void uncompleteSet(setId),
    onDeleteSet: (setId) => void deleteSet(setId),
    onAddSet: (weId) => void addSet(weId),
    onReplace: (weId) => setPicker({ kind: 'replace', workoutExerciseId: weId }),
    onRemove: (weId) => void removeExercise(weId),
    onToggleSuperset: (weId) => void toggleSuperset(workout.id, weId),
    onSaveNote: (weId, note) => void saveExerciseNote(weId, note),
  }
  const ids = model.exercises.map((e) => e.we.id)

  return (
    <>
      <div className="flex flex-col gap-4">
        {model.blocks.map((block, i) => (
          <ExerciseBlock
            key={block.exercises[0]!.we.id}
            block={block}
            position={i + 1}
            count={model.blocks.length}
            unit={model.settings.unit}
            hasNextExercise={(weId) => ids.indexOf(weId) < ids.length - 1}
            handlers={handlers}
            stacked
          />
        ))}
        <Button variant="secondary" className="uppercase" onClick={() => setPicker({ kind: 'add' })}>
          <Plus aria-hidden="true" className="size-5" />
          Añadir ejercicio
        </Button>
        <SensationsEditor
          value={sensations}
          rpe={summary.rpe}
          onChange={(patch) => {
            setSensations((s) => ({ ...s, ...patch }))
            void updateWorkout(workout.id, patch)
          }}
        />
      </div>

      {picker && (
        <ExercisePicker
          excludeIds={picker.kind === 'add' ? model.exercises.map((e) => e.we.exerciseId) : []}
          onCancel={() => setPicker(null)}
          onConfirm={(exerciseIds) => {
            setPicker(null)
            if (picker.kind === 'replace') {
              if (exerciseIds[0]) void replaceExercise(picker.workoutExerciseId, exerciseIds[0])
              return
            }
            void addExercises(workout.id, exerciseIds)
          }}
        />
      )}
    </>
  )
}

/**
 * V8 · Editar sesión: the session's exercises with V5's set rows, plus its sensations and note.
 * Every change is saved as it happens; PRs and metrics are derived, so they follow (R26, KTD7).
 */
export function EditSession() {
  const { workoutId = '' } = useParams()
  const { data, model, lookup } = useSession(workoutId)
  const detail = `/historial/sesiones/${workoutId}`
  const done = (
    <Link to={detail} className="inline-flex min-h-12 items-center rounded-lg px-3 font-bold text-sol">
      Listo
    </Link>
  )

  return (
    <>
      <PageHeader title="Editar sesión" leading={<BackLink to={detail} />} actions={done} />
      {data === null && <p className="text-polvo">Esta sesión ya no existe.</p>}
      {data && model && <Editor key={workoutId} data={data} model={model} lookup={lookup} />}
    </>
  )
}
