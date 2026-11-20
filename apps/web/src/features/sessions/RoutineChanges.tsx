import { describeChange, type Exercise, type Id, type RoutineChange, type WeightUnit } from '@training-log/domain'
import { useId } from 'react'
import { ChoiceGroup } from '../../ui/ChoiceGroup'

export type RoutineDecision = 'update' | 'once'

const CHOICES = [
  { value: 'update', label: 'Sí' },
  { value: 'once', label: 'Solo esta vez' },
] as const

/**
 * V7 · "¿Actualizar la rutina?" (R24): the domain routine-diff as a list, then Sí or Solo esta
 * vez. The decision applies when the workout is saved.
 */
export function RoutineChanges({
  changes,
  lookup,
  unit,
  decision,
  onDecide,
}: {
  changes: RoutineChange[]
  lookup: Map<Id, Exercise>
  unit: WeightUnit
  decision: RoutineDecision
  onDecide: (decision: RoutineDecision) => void
}) {
  const titleId = useId()
  const exerciseName = (id: Id) => lookup.get(id)?.name ?? 'Ejercicio'
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3 rounded-xl border border-sol/60 bg-asfalto p-3">
      <h2 id={titleId} className="font-display text-xl uppercase">
        ¿Actualizar la rutina?
      </h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
        {changes.map((c, i) => (
          <li key={i}>{describeChange(c, { exerciseName, unit })}</li>
        ))}
      </ul>
      <ChoiceGroup label="Con estos cambios" choices={CHOICES} value={decision} onChange={onDecide} />
    </section>
  )
}
