import { useId } from 'react'

export interface Choice<V extends string | number> {
  value: V
  label: string
}

export interface ChoiceGroupProps<V extends string | number> {
  /** Accessible name of the group; shown as its legend. */
  label: string
  choices: readonly Choice<V>[]
  value: V
  onChange: (value: V) => void
}

/**
 * Segmented single choice built on native radios (keyboard and screen readers for free).
 * Each option is a 48 px target; the selected one is Sol with a heavier weight, not color only.
 */
export function ChoiceGroup<V extends string | number>({ label, choices, value, onChange }: ChoiceGroupProps<V>) {
  const name = useId()
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm text-polvo">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex gap-2">
        {choices.map((c) => {
          const checked = c.value === value
          return (
            <label
              key={String(c.value)}
              className={`flex min-h-12 min-w-12 flex-1 cursor-pointer items-center justify-center rounded-lg border px-2 has-focus-visible:outline-2 has-focus-visible:outline-sol ${
                checked ? 'border-sol bg-sol font-bold text-tinta' : 'border-concreto bg-asfalto text-arena'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={String(c.value)}
                checked={checked}
                onChange={() => onChange(c.value)}
                className="sr-only"
              />
              {c.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
