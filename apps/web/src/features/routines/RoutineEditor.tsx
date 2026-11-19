import type { Id, SetType, TrackingType, WeightUnit } from '@training-log/domain'
import { useLiveQuery } from 'dexie-react-hooks'
import { GripVertical, X } from 'lucide-react'
import { useEffect, useId, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { PageHeader } from '../../app/PageHeader'
import { listFolders } from '../../data/repositories/folders'
import { DEFAULT_SETTINGS, getSettings } from '../../data/repositories/settings'
import { Button } from '../../ui/Button'
import { useExerciseLookup } from '../exercises/catalog'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { BackLink } from './components/BackLink'
import type { HomeLocationState } from './Home'
import {
  emptyDraft,
  loadDraft,
  moveItem,
  newDraftExercise,
  newDraftSet,
  ROUTINE_COLORS,
  saveDraft,
  type DraftExercise,
  type DraftSet,
  type RoutineDraft,
} from './routine-ops'

const SET_TYPES: { value: SetType; label: string }[] = [
  { value: 'warmup', label: 'Calentamiento' },
  { value: 'normal', label: 'Normal' },
  { value: 'drop', label: 'Drop set' },
  { value: 'failure', label: 'Al fallo' },
]

const inputClass =
  'min-h-12 w-full min-w-0 rounded-lg border border-concreto bg-hierro px-3 text-arena placeholder:text-polvo'

/**
 * Pointer drag on a handle (touch and mouse): moving over another card's
 * `data-reorder-index` moves the dragged card there; `onMove` must use a functional state update. Subir/Bajar are the button alternative (KTD16).
 */
function dragReorder(onMove: (from: number, to: number) => void) {
  return (index: number) => (e: ReactPointerEvent<HTMLElement>) => {
    const handle = e.currentTarget
    let current = index
    handle.setPointerCapture?.(e.pointerId)
    const move = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-reorder-index]')
      const target = el ? Number(el.dataset.reorderIndex) : NaN
      if (Number.isInteger(target) && target !== current) {
        onMove(current, target)
        current = target
      }
    }
    const end = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', end)
      handle.removeEventListener('pointercancel', end)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  }
}

/** V3 · Crear / editar rutina. */
export function RoutineEditor() {
  const { routineId } = useParams()
  const navigate = useNavigate()
  const settings = useLiveQuery(getSettings, []) ?? DEFAULT_SETTINGS
  const folders = useLiveQuery(listFolders, [], [])
  const { byId } = useExerciseLookup()
  const [draft, setDraft] = useState<RoutineDraft | null>(routineId ? null : emptyDraft())
  const [missing, setMissing] = useState(false)
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const nameId = useId()
  const folderSelectId = useId()
  const backTo = routineId ? `/rutinas/${routineId}` : '/'

  useEffect(() => {
    if (!routineId) return
    let alive = true
    void (async () => {
      const unit = (await getSettings())?.unit ?? DEFAULT_SETTINGS.unit
      const loaded = await loadDraft(routineId, unit)
      if (!alive) return
      if (loaded) setDraft(loaded)
      else setMissing(true)
    })()
    return () => {
      alive = false
    }
  }, [routineId])

  const exerciseName = (id: Id) => byId.get(id)?.name ?? 'Ejercicio'
  const trackingOf = (id: Id): TrackingType => byId.get(id)?.trackingType ?? 'weight_reps'

  const moveExercise = (from: number, to: number) =>
    setDraft((d) => (d ? { ...d, exercises: moveItem(d.exercises, from, to) } : d))
  const startDrag = dragReorder(moveExercise)

  if (missing) {
    return (
      <>
        <PageHeader title="Editar rutina" leading={<BackLink to="/" />} />
        <p className="text-polvo">Esta rutina ya no existe.</p>
      </>
    )
  }
  if (!draft) return <PageHeader title="Editar rutina" leading={<BackLink to={backTo} />} />

  const update = (patch: Partial<RoutineDraft>) => setDraft({ ...draft, ...patch })
  const updateExercise = (key: string, patch: Partial<DraftExercise>) =>
    update({ exercises: draft.exercises.map((e) => (e.key === key ? { ...e, ...patch } : e)) })

  function moveWithButton(index: number, to: number) {
    const ex = draft!.exercises[index]!
    moveExercise(index, to)
    setAnnouncement(`${exerciseName(ex.exerciseId)}: posición ${to + 1} de ${draft!.exercises.length}`)
  }

  async function save() {
    if (!draft || !draft.name.trim()) return
    setSaving(true)
    const routine = await saveDraft(draft, trackingOf, settings.unit)
    if (draft.id) void navigate(`/rutinas/${routine.id}`, { replace: true })
    else void navigate('/', { replace: true, state: { savedRoutineId: routine.id } satisfies HomeLocationState })
  }

  return (
    <>
      <PageHeader title={draft.id ? 'Editar rutina' : 'Nueva rutina'} leading={<BackLink to={backTo} />} />
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor={nameId} className="text-sm text-polvo">
            Nombre
          </label>
          <input
            id={nameId}
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Ej. Torso A"
            required
            className={inputClass}
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm text-polvo">Color</legend>
          <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2">
            {ROUTINE_COLORS.map((c) => (
              <label
                key={c.value}
                className="relative flex size-12 cursor-pointer items-center justify-center rounded-full has-checked:ring-2 has-checked:ring-arena has-focus-visible:outline-2 has-focus-visible:outline-sol"
              >
                <input
                  type="radio"
                  name="routine-color"
                  value={c.value}
                  checked={draft.color === c.value}
                  onChange={() => update({ color: c.value })}
                  aria-label={c.label}
                  className="sr-only"
                />
                <span aria-hidden="true" className="size-9 rounded-full" style={{ backgroundColor: c.value }} />
                {draft.color === c.value && (
                  <span aria-hidden="true" className="absolute font-bold text-hierro">
                    ✓
                  </span>
                )}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <label htmlFor={folderSelectId} className="text-sm text-polvo">
            Carpeta
          </label>
          <select
            id={folderSelectId}
            value={draft.folderId}
            onChange={(e) => update({ folderId: e.target.value })}
            className={inputClass}
          >
            <option value="">Sin carpeta</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
            <option value="new">+ Nueva carpeta…</option>
          </select>
          {draft.folderId === 'new' && (
            <input
              aria-label="Nombre de la carpeta nueva"
              value={draft.newFolderName}
              onChange={(e) => update({ newFolderName: e.target.value })}
              placeholder="Ej. Push/Pull/Legs"
              className={inputClass}
            />
          )}
        </div>

        <label className="flex flex-col gap-2 text-sm text-polvo">
          Nota general
          <textarea
            value={draft.notes}
            onChange={(e) => update({ notes: e.target.value })}
            rows={2}
            className="rounded-lg border border-concreto bg-hierro px-3 py-2 text-base text-arena"
          />
        </label>

        <p role="status" className="sr-only">
          {announcement}
        </p>

        <ol className="flex flex-col gap-3">
          {draft.exercises.map((ex, i) => {
            const prevLinked = i > 0 && draft.exercises[i - 1]!.supersetNext
            const inSuperset = prevLinked || (ex.supersetNext && i < draft.exercises.length - 1)
            return (
              <li key={ex.key} data-reorder-index={i}>
                <ExerciseCard
                  ex={ex}
                  name={exerciseName(ex.exerciseId)}
                  trackingType={trackingOf(ex.exerciseId)}
                  unit={settings.unit}
                  defaultRestSec={settings.defaultRestSec}
                  isFirst={i === 0}
                  isLast={i === draft.exercises.length - 1}
                  inSuperset={inSuperset}
                  onChange={(patch) => updateExercise(ex.key, patch)}
                  onUp={() => moveWithButton(i, i - 1)}
                  onDown={() => moveWithButton(i, i + 1)}
                  onRemove={() => update({ exercises: draft.exercises.filter((e) => e.key !== ex.key) })}
                  onDragStart={startDrag(i)}
                />
              </li>
            )
          })}
        </ol>

        <Button variant="secondary" onClick={() => setPicking(true)}>
          + Añadir ejercicios
        </Button>

        <div className="sticky bottom-0 flex gap-2 bg-hierro py-2">
          <Button variant="ghost" className="flex-1" onClick={() => void navigate(backTo)}>
            Descartar
          </Button>
          <Button type="submit" className="flex-1" disabled={!draft.name.trim() || saving}>
            Guardar
          </Button>
        </div>
      </form>

      {picking && (
        <div className="fixed inset-0 z-[60] mx-auto max-w-[480px] overflow-y-auto bg-hierro">
          <ExercisePicker
            excludeIds={draft.exercises.map((e) => e.exerciseId)}
            onCancel={() => setPicking(false)}
            onConfirm={(ids) => {
              setPicking(false)
              update({ exercises: [...draft.exercises, ...ids.map(newDraftExercise)] })
            }}
          />
        </div>
      )}
    </>
  )
}

function ExerciseCard({
  ex,
  name,
  trackingType,
  unit,
  defaultRestSec,
  isFirst,
  isLast,
  inSuperset,
  onChange,
  onUp,
  onDown,
  onRemove,
  onDragStart,
}: {
  ex: DraftExercise
  name: string
  trackingType: TrackingType
  unit: WeightUnit
  defaultRestSec: number
  isFirst: boolean
  isLast: boolean
  inSuperset: boolean
  onChange: (patch: Partial<DraftExercise>) => void
  onUp: () => void
  onDown: () => void
  onRemove: () => void
  onDragStart: (e: ReactPointerEvent<HTMLElement>) => void
}) {
  const titleId = useId()
  const updateSet = (key: string, patch: Partial<DraftSet>) =>
    onChange({ sets: ex.sets.map((s) => (s.key === key ? { ...s, ...patch } : s)) })
  const weightLabel = trackingType === 'reps' ? `Lastre (${unit})` : `Peso objetivo (${unit})`

  return (
    <section
      aria-labelledby={titleId}
      className={`flex flex-col gap-3 rounded-xl border bg-asfalto p-3 ${
        inSuperset ? 'border-l-4 border-sol bg-fondo-superserie' : 'border-concreto'
      }`}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Arrastrar para reordenar"
          onPointerDown={onDragStart}
          className="inline-flex min-h-12 min-w-10 cursor-grab touch-none items-center justify-center text-polvo"
        >
          <GripVertical aria-hidden="true" className="size-5" />
        </button>
        <h2 id={titleId} className="min-w-0 flex-1 truncate font-bold">
          {name}
        </h2>
        {inSuperset && <span className="text-xs font-bold text-sol uppercase">Superserie</span>}
        <button
          type="button"
          aria-label="Quitar ejercicio"
          onClick={onRemove}
          className="inline-flex min-h-12 min-w-12 items-center justify-center text-polvo"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" disabled={isFirst} onClick={onUp}>
          Subir
        </Button>
        <Button variant="secondary" className="flex-1" disabled={isLast} onClick={onDown}>
          Bajar
        </Button>
      </div>

      <ol className="flex flex-col gap-2">
        {ex.sets.map((s, i) => {
          const n = i + 1
          return (
            <li key={s.key} className="flex flex-wrap items-end gap-2 border-t border-concreto pt-2">
              <span className="w-full text-sm text-polvo">Serie {n}</span>
              <select
                aria-label={`Tipo, serie ${n}`}
                value={s.type}
                onChange={(e) => updateSet(s.key, { type: e.target.value as SetType })}
                className={`${inputClass} w-auto flex-1`}
              >
                {SET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {trackingType === 'time' ? (
                <input
                  aria-label={`Duración objetivo (s), serie ${n}`}
                  inputMode="numeric"
                  value={s.durationSec}
                  onChange={(e) => updateSet(s.key, { durationSec: e.target.value })}
                  placeholder="s"
                  className={`${inputClass} w-20 flex-none`}
                />
              ) : (
                <>
                  <input
                    aria-label={`Reps mín., serie ${n}`}
                    inputMode="numeric"
                    value={s.repsMin}
                    onChange={(e) => updateSet(s.key, { repsMin: e.target.value })}
                    placeholder="8"
                    className={`${inputClass} w-14 flex-none`}
                  />
                  <span aria-hidden="true" className="self-center text-polvo">
                    –
                  </span>
                  <input
                    aria-label={`Reps máx., serie ${n}`}
                    inputMode="numeric"
                    value={s.repsMax}
                    onChange={(e) => updateSet(s.key, { repsMax: e.target.value })}
                    placeholder="12"
                    className={`${inputClass} w-14 flex-none`}
                  />
                  <input
                    aria-label={`${weightLabel}, serie ${n}`}
                    inputMode="decimal"
                    value={s.weight}
                    onChange={(e) => updateSet(s.key, { weight: e.target.value })}
                    placeholder={trackingType === 'reps' ? `+${unit}` : unit}
                    className={`${inputClass} w-20 flex-none`}
                  />
                </>
              )}
              <button
                type="button"
                aria-label={`Quitar serie ${n}`}
                onClick={() => onChange({ sets: ex.sets.filter((x) => x.key !== s.key) })}
                className="inline-flex min-h-12 min-w-12 items-center justify-center text-polvo"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          )
        })}
      </ol>
      <Button variant="secondary" onClick={() => onChange({ sets: [...ex.sets, newDraftSet(ex.sets.at(-1))] })}>
        + Serie
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm text-polvo">
          Descanso propio (s)
          <input
            inputMode="numeric"
            value={ex.restSec}
            onChange={(e) => onChange({ restSec: e.target.value })}
            placeholder={`${defaultRestSec} (global)`}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-polvo">
          Nota fija
          <input
            value={ex.note}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder="Ej. agarre neutro"
            className={inputClass}
          />
        </label>
      </div>
      {!isLast && (
        <label className="flex min-h-12 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={ex.supersetNext}
            onChange={(e) => onChange({ supersetNext: e.target.checked })}
            className="size-6 accent-sol"
          />
          Superserie con el siguiente
        </label>
      )}
    </section>
  )
}
