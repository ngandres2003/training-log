import {
  displayWeight,
  formatWeightValue,
  lbToKg,
  parseWeightInput,
  type TrackingType,
  type WeightUnit,
} from '@training-log/domain'
import { Check, Pause, Timer } from 'lucide-react'
import { useState } from 'react'
import { ActionMenu } from './components/ActionMenu'
import { compactSet, decimalText, durationText, parseDuration, parseRpe } from './format'
import { NumberStepper } from './NumberStepper'
import { useNow } from './use-now'
import type { SetModel } from './view-model'
import type { SetPatch } from './workout-actions'

type Key = 'weight' | 'reps' | 'durationSec' | 'rpe'

interface Field {
  key: Key
  /** Column header, also the start of the input's accessible name. */
  header: string
  aria: string
}

/** R14 columns per tracking type, plus optional RPE (R21). */
export function fieldsFor(trackingType: TrackingType, unit: WeightUnit): Field[] {
  const rpe: Field = { key: 'rpe', header: 'RPE', aria: 'RPE' }
  switch (trackingType) {
    case 'weight_reps':
      return [{ key: 'weight', header: unit.toUpperCase(), aria: unit }, { key: 'reps', header: 'Reps', aria: 'Reps' }, rpe]
    case 'reps':
      return [
        { key: 'weight', header: `+${unit.toUpperCase()}`, aria: `+${unit}` },
        { key: 'reps', header: 'Reps', aria: 'Reps' },
        rpe,
      ]
    case 'time':
      return [{ key: 'durationSec', header: 'Tiempo', aria: 'Tiempo' }, rpe]
  }
}

function formatValue(key: Key, value: number, unit: WeightUnit): string {
  switch (key) {
    case 'weight':
      return formatWeightValue(value, unit)
    case 'durationSec':
      return durationText(value)
    case 'rpe':
      return decimalText(value)
    case 'reps':
      return String(value)
  }
}

/** Parsed value, null for an empty field, undefined when the text is not valid. */
function parseValue(key: Key, text: string, unit: WeightUnit): number | null | undefined {
  if (text.trim() === '') return null
  let parsed: number | null
  switch (key) {
    case 'weight':
      parsed = parseWeightInput(text, unit)
      break
    case 'durationSec':
      parsed = parseDuration(text)
      break
    case 'rpe':
      parsed = parseRpe(text)
      break
    case 'reps':
      parsed = /^\d+$/.test(text.trim()) ? Number(text.trim()) : null
  }
  return parsed ?? undefined
}

function step(key: Key, base: number, direction: 1 | -1, unit: WeightUnit): number {
  switch (key) {
    case 'weight':
      // Canonical kg (KTD10); lb moves 5 lb on the shown value.
      return Math.max(0, unit === 'lb' ? lbToKg(displayWeight(base, 'lb') + 5 * direction) : base + 2.5 * direction)
    case 'durationSec':
      return Math.max(0, base + 5 * direction)
    default:
      return Math.max(0, base + direction)
  }
}

export interface SetRowProps {
  model: SetModel
  trackingType: TrackingType
  unit: WeightUnit
  /** Row name in accessible labels: "3" or "A1". */
  rowName: string
  /** Visual label: "C", "2", "A1". */
  label: string
  active: boolean
  onActivate: () => void
  onSave: (patch: SetPatch) => void
  onComplete: (values: SetPatch) => void
  onUncomplete: () => void
  onDelete: () => void
}

/**
 * One set row of V5. Untouched fields are empty with the R18 prefill as a grey placeholder
 * (Polvo); typed or completed values are Arena. ✓ stores what is shown in one tap.
 */
export function SetRow(props: SetRowProps) {
  const { model, trackingType, unit, rowName, active } = props
  const { set } = model
  const fields = fieldsFor(trackingType, unit)
  const [drafts, setDrafts] = useState<Partial<Record<Key, string>>>({})
  // Values committed here but not yet back from Dexie, so ✓ never reads a stale row.
  const [pending, setPending] = useState<SetPatch>({})
  const [stopwatchFrom, setStopwatchFrom] = useState<number | null>(null)
  const now = useNow(stopwatchFrom !== null)

  // A new version of the row arrived from Dexie: drop the pending copy.
  const [seenVersion, setSeenVersion] = useState(set.updatedAt)
  if (seenVersion !== set.updatedAt) {
    setSeenVersion(set.updatedAt)
    setPending({})
  }

  const stored = (key: Key): number | null => (key in pending ? (pending[key] ?? null) : set[key])
  const current = (key: Key): number | null => {
    const draft = drafts[key]
    if (draft !== undefined) {
      const parsed = parseValue(key, draft, unit)
      if (parsed !== undefined) return parsed
    }
    return stored(key)
  }
  const shown = (key: 'weight' | 'reps' | 'durationSec') => current(key) ?? model.suggestion?.[key] ?? null

  const save = (patch: SetPatch) => {
    setPending((p) => ({ ...p, ...patch }))
    props.onSave(patch)
  }

  const commit = (key: Key) => {
    const draft = drafts[key]
    if (draft === undefined) return
    setDrafts(({ [key]: _, ...rest }) => rest)
    const parsed = parseValue(key, draft, unit)
    if (parsed === undefined || parsed === stored(key)) return
    save({ [key]: parsed })
  }

  const canComplete = trackingType === 'time' ? shown('durationSec') != null : shown('reps') != null

  const toggle = () => {
    if (set.completed) return props.onUncomplete()
    setDrafts({})
    const values: SetPatch = { rpe: current('rpe') }
    if (trackingType === 'time') values.durationSec = shown('durationSec')
    else {
      values.weight = shown('weight')
      values.reps = shown('reps')
    }
    props.onComplete(values)
  }

  const toggleStopwatch = () => {
    if (stopwatchFrom === null) {
      setStopwatchFrom(Date.now())
      return
    }
    const seconds = Math.round((Date.now() - stopwatchFrom) / 1000)
    setStopwatchFrom(null)
    save({ durationSec: seconds })
  }

  const inputValue = (key: Key) => {
    if (key === 'durationSec' && stopwatchFrom !== null) return durationText(Math.max(0, Math.floor((now - stopwatchFrom) / 1000)))
    const draft = drafts[key]
    if (draft !== undefined) return draft
    const value = stored(key)
    return value == null ? '' : formatValue(key, value, unit)
  }

  const placeholder = (key: Key) => {
    if (key === 'rpe') return '' // never prefilled (R21)
    const value = model.suggestion?.[key]
    return value == null ? '' : formatValue(key, value, unit)
  }

  const steppable = fields.filter((f) => f.key !== 'rpe')

  return (
    <>
      <tr aria-label={`Fila ${rowName}`} className={`transition-colors duration-300 ease-suave ${set.completed ? 'bg-sol/10' : ''}`}>
        <td className="w-12 py-1 pl-1">
          <div className="flex flex-col items-center">
            <ActionMenu
              label={`Opciones de la fila ${rowName}`}
              items={[{ label: 'Eliminar serie', destructive: true, onSelect: props.onDelete }]}
              className="font-display text-lg text-arena"
            >
              {props.label}
            </ActionMenu>
          </div>
        </td>
        <td className="max-w-20 truncate px-1 text-sm text-polvo">
          <div className="flex flex-col">
            <span>{model.previous ? compactSet(model.previous, trackingType, unit) : '—'}</span>
            {model.pr && (
              <span className="text-xs font-bold text-atardecer motion-safe:animate-pulse">
                <span>PR</span>
                <span className="sr-only">, nueva marca personal</span>
              </span>
            )}
          </div>
        </td>
        {fields.map((f) => (
          <td key={f.key} className="px-0.5 py-1">
            <div className="flex items-center gap-0.5">
              <input
                type="text"
                inputMode={f.key === 'reps' ? 'numeric' : f.key === 'durationSec' ? 'text' : 'decimal'}
                aria-label={`${f.aria} fila ${rowName}`}
                value={inputValue(f.key)}
                placeholder={placeholder(f.key)}
                readOnly={f.key === 'durationSec' && stopwatchFrom !== null}
                onFocus={props.onActivate}
                onChange={(e) => setDrafts((d) => ({ ...d, [f.key]: e.target.value }))}
                onBlur={() => commit(f.key)}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className={`h-12 w-full min-w-0 rounded-lg bg-concreto px-1 text-center font-display text-lg text-arena outline-none ring-sol transition-[box-shadow,background-color] duration-150 placeholder:text-polvo focus:bg-asfalto focus:ring-2 ${
                  f.key === 'rpe' ? 'max-w-12' : ''
                }`}
              />
              {f.key === 'durationSec' && (
                <button
                  type="button"
                  aria-label={stopwatchFrom === null ? `Cronometrar fila ${rowName}` : `Detener cronómetro fila ${rowName}`}
                  onClick={toggleStopwatch}
                  className={`inline-flex size-12 shrink-0 items-center justify-center rounded-lg ${
                    stopwatchFrom === null ? 'text-polvo' : 'bg-sol text-tinta'
                  }`}
                >
                  {stopwatchFrom === null ? (
                    <Timer aria-hidden="true" className="size-5" />
                  ) : (
                    <Pause aria-hidden="true" className="size-5" />
                  )}
                </button>
              )}
            </div>
          </td>
        ))}
        <td className="w-12 py-1 pr-1">
          <button
            type="button"
            aria-label={`Completar fila ${rowName}`}
            aria-pressed={set.completed}
            disabled={!set.completed && !canComplete}
            onClick={toggle}
            className={`inline-flex size-12 items-center justify-center rounded-lg transition-[background-color,color,transform] duration-200 ease-suave active:scale-90 disabled:opacity-40 ${
              set.completed ? 'animate-pop bg-sol text-tinta' : 'bg-concreto text-polvo'
            }`}
          >
            <Check aria-hidden="true" className="size-6" strokeWidth={set.completed ? 3 : 2} />
          </button>
        </td>
      </tr>
      {active && !set.completed && steppable.length > 0 && (
        <tr aria-label={`Ajustar fila ${rowName}`} className="animate-rise">
          <td colSpan={fields.length + 3} className="px-1 pb-2">
            <div className="flex gap-2">
              {steppable.map((f) => {
                const value = shown(f.key as 'weight' | 'reps' | 'durationSec')
                return (
                  <NumberStepper
                    key={f.key}
                    label={`${f.aria} fila ${rowName}`}
                    value={value == null ? '—' : formatValue(f.key, value, unit)}
                    onStep={(direction) => save({ [f.key]: step(f.key, value ?? 0, direction, unit) })}
                  />
                )
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
