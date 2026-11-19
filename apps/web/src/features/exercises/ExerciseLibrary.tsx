import type { CustomExercise } from '@training-log/domain'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '../../app/PageHeader'
import { CreateExercise } from './CreateExercise'
import { ExerciseBrowser } from './ExerciseBrowser'

type Editing = { kind: 'create'; initialName: string } | { kind: 'edit'; exercise: CustomExercise } | null

/** V4 in management mode, opened from V12 (Perfil → Ejercicios). */
export function ExerciseLibrary() {
  const [editing, setEditing] = useState<Editing>(null)
  const close = () => setEditing(null)

  if (editing) {
    return (
      <CreateExercise
        key={editing.kind === 'edit' ? editing.exercise.id : 'new'}
        initialName={editing.kind === 'create' ? editing.initialName : undefined}
        exercise={editing.kind === 'edit' ? editing.exercise : undefined}
        onSaved={close}
        onCancel={close}
        onDeleted={close}
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Ejercicios"
        leading={
          <Link
            to="/perfil"
            aria-label="Volver"
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg text-polvo"
          >
            <ArrowLeft aria-hidden="true" className="size-6" />
          </Link>
        }
      />
      <ExerciseBrowser
        mode="manage"
        onCreate={(initialName) => setEditing({ kind: 'create', initialName })}
        onEdit={(exercise) => setEditing({ kind: 'edit', exercise })}
      />
    </>
  )
}
