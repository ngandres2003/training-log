import { MUSCLES, type CustomExercise, type Equipment, type TrackingType } from '@training-log/domain'
import { useLiveQuery } from 'dexie-react-hooks'
import { X } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import {
  createCustomExercise,
  deleteCustomExercise,
  updateCustomExercise,
} from '../../data/repositories/exercises'
import { Button } from '../../ui/Button'
import { ChoiceGroup } from '../../ui/ChoiceGroup'
import { compressImage } from './compress-image'
import { EquipmentIcon } from './EquipmentIcon'
import { EQUIPMENT_LABELS, exercisesWithHistory, TRACKING_LABELS } from './exercise-list'
import { loadWorkoutTables, useOnline } from './hooks'
import { uploadPhoto } from './upload-photo'

const EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[]
const TRACKING_CHOICES = (Object.keys(TRACKING_LABELS) as TrackingType[]).map((value) => ({
  value,
  label: TRACKING_LABELS[value],
}))

export interface CreateExerciseProps {
  /** Prefilled name, e.g. from a search with no results. */
  initialName?: string
  /** Edit this custom exercise instead of creating one. */
  exercise?: CustomExercise
  onSaved: (exercise: CustomExercise) => void
  onCancel: () => void
  /** Called after the exercise was deleted (edit mode only). */
  onDeleted?: () => void
  /** Injectable for tests (jsdom has no canvas or network). */
  compress?: (file: Blob) => Promise<Blob>
  upload?: (blob: Blob) => Promise<string>
}

const inputClass = 'min-h-12 w-full rounded-lg border border-concreto bg-asfalto px-3 text-arena'

/**
 * "Crear ejercicio" (V4): same structure as a catalog entry plus an optional own photo.
 * Muscles come from the fixed list (R17). Offline, the photo picker is disabled and the
 * exercise is saved without a photo.
 */
export function CreateExercise({
  initialName = '',
  exercise,
  onSaved,
  onCancel,
  onDeleted,
  compress = (file) => compressImage(file),
  upload = (blob) => uploadPhoto(blob),
}: CreateExerciseProps) {
  const ids = useId()
  const online = useOnline()
  const tables = useLiveQuery(loadWorkoutTables)
  const [name, setName] = useState(exercise?.name ?? initialName)
  const [primaryMuscle, setPrimaryMuscle] = useState(exercise?.primaryMuscle ?? '')
  const [secondary, setSecondary] = useState<string[]>(exercise?.secondaryMuscles ?? [])
  const [equipment, setEquipment] = useState<Equipment>(exercise?.equipment ?? 'barbell')
  const [trackingType, setTrackingType] = useState<TrackingType>(exercise?.trackingType ?? 'weight_reps')
  const [imageUrl, setImageUrl] = useState<string | null>(exercise?.imageUrl ?? null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const hasHistory = exercise && tables ? exercisesWithHistory(tables).has(exercise.id) : false

  function toggleSecondary(id: string) {
    setSecondary((s) => (s.includes(id) ? s.filter((m) => m !== id) : [...s, id]))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Escribe un nombre.')
    if (!primaryMuscle) return setError('Elige el músculo principal.')
    setError(null)
    setSaving(true)
    try {
      let url = imageUrl
      if (photo) {
        try {
          url = await upload(await compress(photo))
        } catch {
          setError('No se pudo subir la foto. Quítala para guardar sin foto o inténtalo de nuevo.')
          return
        }
      }
      const input = {
        name: trimmed,
        primaryMuscle,
        secondaryMuscles: secondary.filter((m) => m !== primaryMuscle),
        equipment,
        trackingType,
        imageUrl: url,
      }
      const saved = exercise ? await updateCustomExercise(exercise.id, input) : await createCustomExercise(input)
      onSaved(saved)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!exercise) return
    // Re-check against the database: a custom exercise with history can only be edited.
    if (exercisesWithHistory(await loadWorkoutTables()).has(exercise.id)) return
    await deleteCustomExercise(exercise.id)
    onDeleted?.()
  }

  const title = exercise ? 'Editar ejercicio' : 'Crear ejercicio'

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 pb-8" noValidate>
      <div className="flex items-center gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancelar"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg text-polvo"
        >
          <X aria-hidden="true" className="size-6" />
        </button>
        <h2 className="flex-1 font-display text-2xl uppercase">{title}</h2>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-asfalto text-polvo">
          {imageUrl && !photo ? (
            <img src={imageUrl} alt="Foto actual" className="size-full object-cover" />
          ) : (
            <EquipmentIcon equipment={equipment} className="size-8" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={`${ids}-photo`} className="text-sm text-polvo">
            Foto (opcional)
          </label>
          <input
            id={`${ids}-photo`}
            type="file"
            accept="image/*"
            disabled={!online}
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="min-h-12 text-sm text-arena file:mr-3 file:min-h-12 file:rounded-lg file:border file:border-concreto file:bg-asfalto file:px-3 file:text-arena disabled:opacity-50"
          />
          {!online && <p className="text-sm text-polvo">La foto se puede añadir cuando haya conexión</p>}
          {photo && <p className="truncate text-sm text-polvo">{photo.name}</p>}
          {(photo || imageUrl) && (
            <button
              type="button"
              onClick={() => {
                setPhoto(null)
                setImageUrl(null)
              }}
              className="min-h-12 self-start text-sm font-medium text-sol"
            >
              Quitar foto
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${ids}-name`} className="text-sm text-polvo">
          Nombre
        </label>
        <input
          id={`${ids}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${ids}-primary`} className="text-sm text-polvo">
          Músculo principal
        </label>
        <select
          id={`${ids}-primary`}
          value={primaryMuscle}
          onChange={(e) => setPrimaryMuscle(e.target.value)}
          className={inputClass}
        >
          <option value="">Elige un músculo</option>
          {MUSCLES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm text-polvo">Músculos secundarios</legend>
        <div className="flex flex-wrap gap-2">
          {MUSCLES.filter((m) => m.id !== primaryMuscle).map((m) => {
            const checked = secondary.includes(m.id)
            return (
              <label
                key={m.id}
                className={`flex min-h-12 cursor-pointer items-center rounded-lg border px-3 has-focus-visible:outline-2 has-focus-visible:outline-sol ${
                  checked ? 'border-sol bg-sol font-bold text-tinta' : 'border-concreto bg-asfalto text-arena'
                }`}
              >
                <input type="checkbox" checked={checked} onChange={() => toggleSecondary(m.id)} className="sr-only" />
                {checked && <span aria-hidden="true">✓&nbsp;</span>}
                {m.label}
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${ids}-equipment`} className="text-sm text-polvo">
          Equipamiento
        </label>
        <select
          id={`${ids}-equipment`}
          value={equipment}
          onChange={(e) => setEquipment(e.target.value as Equipment)}
          className={inputClass}
        >
          {EQUIPMENT.map((eq) => (
            <option key={eq} value={eq}>
              {EQUIPMENT_LABELS[eq]}
            </option>
          ))}
        </select>
      </div>

      <ChoiceGroup label="Tipo de registro" choices={TRACKING_CHOICES} value={trackingType} onChange={setTrackingType} />

      {error && (
        <p role="alert" className="text-sm text-arena">
          {error}
        </p>
      )}

      <Button type="submit" disabled={saving}>
        {saving ? 'Guardando…' : 'Guardar'}
      </Button>

      {exercise &&
        tables &&
        (hasHistory ? (
          <p className="text-sm text-polvo">Tiene historial: solo se puede editar.</p>
        ) : confirmDelete ? (
          <div className="flex flex-col gap-2 rounded-xl border border-concreto bg-asfalto p-3">
            <p className="text-arena">¿Eliminar «{exercise.name}»? No se puede deshacer.</p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={remove}>
                Sí, eliminar
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
            Eliminar ejercicio
          </Button>
        ))}
    </form>
  )
}
