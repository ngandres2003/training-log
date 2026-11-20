import { MUSCLES, type CustomExercise, type Equipment, type Id } from '@training-log/domain'
import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '../../ui/Button'
import { isCustomExercise, useExerciseLookup } from './catalog'
import { EQUIPMENT_LABELS, filterExercises, formatSet, lastSets } from './exercise-list'
import { ExerciseRow } from './ExerciseRow'
import { useWeightUnit, useWorkoutTables } from './hooks'

const EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[]
const selectClass = 'min-h-12 min-w-0 flex-1 rounded-lg border border-concreto bg-asfalto px-2 text-arena'

export type ExerciseBrowserProps = {
  /** Opens "Crear ejercicio", prefilled with the search text when there are no results. */
  onCreate: (initialName: string) => void
} & (
  | { mode: 'select'; selectedIds: Id[]; excludeIds: Id[]; onToggle: (id: Id) => void }
  | { mode: 'manage'; onEdit: (exercise: CustomExercise) => void }
)

/** V4's search, filters and list, shared by the selector and the library. */
export function ExerciseBrowser(props: ExerciseBrowserProps) {
  const { status, all, byId } = useExerciseLookup()
  const tables = useWorkoutTables()
  const unit = useWeightUnit()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)
  const [equipment, setEquipment] = useState<Equipment | null>(null)
  const [mineOnly, setMineOnly] = useState(false)

  const results = useMemo(
    () => filterExercises(all, { query, muscle, equipment, mineOnly }),
    [all, query, muscle, equipment, mineOnly],
  )
  const last = useMemo(() => lastSets(tables, byId), [tables, byId])
  const trimmed = query.trim()

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-polvo" />
        <input
          type="search"
          aria-label="Buscar ejercicio"
          placeholder="Buscar ejercicio"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-12 w-full rounded-lg border border-concreto bg-asfalto pr-3 pl-10 text-arena placeholder:text-polvo"
        />
      </div>

      <div className="flex gap-2">
        <select
          aria-label="Músculo"
          value={muscle ?? ''}
          onChange={(e) => setMuscle(e.target.value || null)}
          className={selectClass}
        >
          <option value="">Todos los músculos</option>
          {MUSCLES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Equipamiento"
          value={equipment ?? ''}
          onChange={(e) => setEquipment((e.target.value || null) as Equipment | null)}
          className={selectClass}
        >
          <option value="">Todo el equipo</option>
          {EQUIPMENT.map((eq) => (
            <option key={eq} value={eq}>
              {EQUIPMENT_LABELS[eq]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={mineOnly}
          onClick={() => setMineOnly((v) => !v)}
          className={`min-h-12 rounded-lg border px-4 ${
            mineOnly ? 'border-sol bg-sol font-bold text-tinta' : 'border-concreto bg-asfalto text-arena'
          }`}
        >
          {mineOnly && <span aria-hidden="true">✓ </span>}
          Mis ejercicios
        </button>
        <Button variant="secondary" className="ml-auto" onClick={() => props.onCreate('')}>
          <Plus aria-hidden="true" className="size-5" />
          Crear ejercicio
        </Button>
      </div>

      {status === 'loading' && (
        <p role="status" className="text-polvo">
          Cargando ejercicios…
        </p>
      )}
      {status === 'unavailable' && (
        <p role="status" className="rounded-lg border border-concreto bg-asfalto p-3 text-polvo">
          Catálogo no disponible sin conexión
        </p>
      )}

      <p className="sr-only" aria-live="polite">
        {status === 'loading' ? '' : `${results.length} ejercicios`}
      </p>

      {status !== 'loading' && results.length === 0 && (
        <div className="flex flex-col items-start gap-2 py-4">
          <p className="text-polvo">Sin resultados.</p>
          {trimmed && <Button onClick={() => props.onCreate(trimmed)}>{`Crear «${trimmed}»`}</Button>}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {results.map((exercise) => {
          const set = last.get(exercise.id)
          const lastTime = set ? formatSet(set, exercise.trackingType, unit) : null
          if (props.mode === 'select') {
            return (
              <ExerciseRow
                key={exercise.id}
                mode="select"
                exercise={exercise}
                lastTime={lastTime}
                selected={props.selectedIds.includes(exercise.id)}
                alreadyAdded={props.excludeIds.includes(exercise.id)}
                onToggle={() => props.onToggle(exercise.id)}
              />
            )
          }
          const onEdit = props.onEdit
          return (
            <ExerciseRow
              key={exercise.id}
              mode="manage"
              exercise={exercise}
              lastTime={lastTime}
              onEdit={isCustomExercise(exercise) ? () => onEdit(exercise) : undefined}
            />
          )
        })}
      </ul>
    </div>
  )
}
