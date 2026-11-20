import { useId } from 'react'
import { decimal1 } from '../routines/format'
import { ENERGY_FACES, SESSION_TAGS } from './format'

export interface SensationValues {
  energy: number | null
  tags: string[]
  note: string
}

function RpeAverage({ rpe }: { rpe: number | null }) {
  // Hidden when no set logged RPE (spec V7).
  if (rpe == null) return null
  return (
    <dl className="flex items-baseline gap-2 text-sm">
      <dt className="text-polvo">RPE medio</dt>
      <dd className="font-display text-xl">{decimal1(rpe)}</dd>
    </dl>
  )
}

/**
 * V7 sensations (R25): energy 1–5 with faces, quick tags and a free note. The session's RPE
 * average is shown read-only underneath; there is no global effort.
 */
export function SensationsEditor({
  value,
  rpe,
  onChange,
}: {
  value: SensationValues
  rpe: number | null
  onChange: (patch: Partial<SensationValues>) => void
}) {
  const name = useId()
  const noteId = useId()
  const toggleTag = (tag: string) =>
    onChange({ tags: value.tags.includes(tag) ? value.tags.filter((t) => t !== tag) : [...value.tags, tag] })

  return (
    <section aria-labelledby={`${name}-title`} className="flex flex-col gap-3">
      <h2 id={`${name}-title`} className="font-display text-xl uppercase">
        Sensaciones
      </h2>
      <div role="radiogroup" aria-label="Energía" className="flex gap-2">
        {ENERGY_FACES.map((face, i) => {
          const level = i + 1
          const checked = value.energy === level
          return (
            <label
              key={level}
              className={`flex min-h-12 min-w-12 flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border has-focus-visible:outline-2 has-focus-visible:outline-sol ${
                checked ? 'border-sol bg-sol/20 font-bold' : 'border-concreto bg-asfalto'
              }`}
            >
              <input
                type="radio"
                name={name}
                checked={checked}
                onChange={() => onChange({ energy: level })}
                className="sr-only"
              />
              <span aria-hidden="true" className="text-2xl">
                {face}
              </span>
              <span aria-hidden="true" className="text-xs text-polvo">
                {level}
              </span>
              <span className="sr-only">Energía {level} de 5</span>
            </label>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {SESSION_TAGS.map((tag) => {
          const on = value.tags.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={on}
              onClick={() => toggleTag(tag)}
              className={`min-h-12 rounded-full border px-4 text-sm ${
                on ? 'border-sol bg-sol font-bold text-hierro' : 'border-concreto bg-asfalto text-arena'
              }`}
            >
              {tag}
            </button>
          )
        })}
      </div>
      <RpeAverage rpe={rpe} />
      <label htmlFor={noteId} className="text-sm text-polvo">
        Nota
      </label>
      <textarea
        id={noteId}
        value={value.note}
        onChange={(e) => onChange({ note: e.target.value })}
        rows={3}
        className="rounded-lg border border-concreto bg-hierro p-3 text-base text-arena"
      />
    </section>
  )
}

/** V8's read-only sensations: energy, tags, RPE average and the note. */
export function SensationsView({ value, rpe }: { value: SensationValues; rpe: number | null }) {
  const empty = value.energy == null && value.tags.length === 0 && rpe == null && !value.note
  if (empty) return null
  return (
    <section aria-label="Sensaciones" className="flex flex-col gap-2">
      {value.energy != null && (
        <dl className="flex items-baseline gap-2 text-sm">
          <dt className="text-polvo">Energía</dt>
          <dd className="font-display text-xl">
            <span aria-hidden="true">{ENERGY_FACES[value.energy - 1]} </span>
            {value.energy}/5
          </dd>
        </dl>
      )}
      {value.tags.length > 0 && (
        <ul aria-label="Etiquetas" className="flex flex-wrap gap-2">
          {value.tags.map((t) => (
            <li key={t} className="rounded-full border border-concreto px-3 py-1 text-sm">
              {t}
            </li>
          ))}
        </ul>
      )}
      <RpeAverage rpe={rpe} />
      {value.note && <p className="whitespace-pre-wrap">{value.note}</p>}
    </section>
  )
}
