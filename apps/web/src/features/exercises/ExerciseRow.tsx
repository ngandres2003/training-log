import { MUSCLES, type Exercise } from '@training-log/domain'
import { Check, Pencil } from 'lucide-react'
import { useState } from 'react'
import { EquipmentIcon } from './EquipmentIcon'

const MUSCLE_LABEL = new Map(MUSCLES.map((m) => [m.id, m.label]))

export function muscleLabel(id: string): string {
  return MUSCLE_LABEL.get(id) ?? id
}

/** Photo, or the equipment icon when there is none or it fails to load (offline, not cached). */
export function ExerciseThumb({ exercise }: { exercise: Exercise }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-hierro text-polvo">
      {exercise.imageUrl && !failed ? (
        <img
          src={exercise.imageUrl}
          alt={`Foto de ${exercise.name}`}
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <EquipmentIcon equipment={exercise.equipment} />
      )}
    </span>
  )
}

export type ExerciseRowProps = {
  exercise: Exercise
  /** "80 kg × 8" from the last local workout, if any. */
  lastTime: string | null
} & (
  | { mode: 'select'; selected: boolean; alreadyAdded: boolean; onToggle: () => void }
  | { mode: 'manage'; onEdit?: () => void }
)

export function ExerciseRow(props: ExerciseRowProps) {
  const { exercise, lastTime } = props
  const body = (
    <>
      <ExerciseThumb exercise={exercise} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span data-testid="exercise-name" className="truncate font-medium text-arena">
          {exercise.name}
        </span>
        <span className="truncate text-sm text-polvo">
          {muscleLabel(exercise.primaryMuscle)}
          {lastTime && (
            <>
              {' · '}
              <span>última vez: {lastTime}</span>
            </>
          )}
        </span>
      </span>
    </>
  )

  if (props.mode === 'select') {
    const checked = props.selected || props.alreadyAdded
    return (
      <li>
        <label
          className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 has-focus-visible:outline-2 has-focus-visible:outline-sol ${
            props.selected ? 'border-sol bg-asfalto' : 'border-concreto bg-asfalto'
          } ${props.alreadyAdded ? 'opacity-60' : ''}`}
        >
          {body}
          {props.alreadyAdded && <span className="text-sm text-polvo">Añadido</span>}
          <input
            type="checkbox"
            aria-label={exercise.name}
            checked={checked}
            disabled={props.alreadyAdded}
            onChange={props.onToggle}
            className="sr-only"
          />
          {/* Check mark plus color, not color only (KTD16). */}
          <span
            aria-hidden="true"
            className={`flex size-8 shrink-0 items-center justify-center rounded-md border-2 ${
              checked ? 'border-sol bg-sol text-tinta' : 'border-concreto'
            }`}
          >
            {checked && <Check className="size-5" strokeWidth={3} />}
          </span>
        </label>
      </li>
    )
  }

  return (
    <li className="flex min-h-16 items-center gap-3 rounded-xl border border-concreto bg-asfalto px-3 py-2">
      {body}
      {props.onEdit && (
        <button
          type="button"
          onClick={props.onEdit}
          aria-label={`Editar ${exercise.name}`}
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg text-polvo"
        >
          <Pencil aria-hidden="true" className="size-5" />
        </button>
      )}
    </li>
  )
}
