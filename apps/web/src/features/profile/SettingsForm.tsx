import type { Settings, Theme, WeekStart, WeightUnit } from '@training-log/domain'
import { useLiveQuery } from 'dexie-react-hooks'
import { useId } from 'react'
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../../data/repositories/settings'
import type { RowPatch } from '../../data/repositories/base'
import { ChoiceGroup } from '../../ui/ChoiceGroup'
import { Section } from './Section'

const UNITS = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
] as const satisfies readonly { value: WeightUnit; label: string }[]
const GOALS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }))
const RESTS = [60, 90, 120, 180].map((s) => ({ value: s, label: `${s} s` }))
const WEEK_STARTS = [
  { value: 'monday', label: 'Lunes' },
  { value: 'sunday', label: 'Domingo' },
] as const satisfies readonly { value: WeekStart; label: string }[]
const THEMES = [
  { value: 'dark', label: 'Oscuro' },
  { value: 'light', label: 'Claro' },
  { value: 'system', label: 'Sistema' },
] as const satisfies readonly { value: Theme; label: string }[]

type Toggle = 'soundOn' | 'vibrationOn' | 'keepScreenOn' | 'preloadPrevious'
const TOGGLES: { key: Toggle; label: string }[] = [
  { key: 'soundOn', label: 'Sonido al terminar el descanso' },
  { key: 'vibrationOn', label: 'Vibración al terminar el descanso' },
  { key: 'keepScreenOn', label: 'Mantener pantalla encendida' },
  { key: 'preloadPrevious', label: 'Precargar valores anteriores' },
]

/** V12 Preferencias, Entreno and Apariencia. Every change saves at once through the settings repository. */
export function SettingsForm() {
  const settings = useLiveQuery(getSettings, [], undefined)
  const s: Omit<Settings, 'id' | 'userId' | 'updatedAt' | 'deletedAt' | 'version'> =
    settings ?? DEFAULT_SETTINGS
  const nameId = useId()
  const save = (patch: RowPatch<'settings'>) => void saveSettings(patch)

  return (
    <>
      <Section title="Preferencias">
        <div className="flex flex-col gap-2">
          <label htmlFor={nameId} className="text-sm text-polvo">
            Nombre
          </label>
          <input
            id={nameId}
            key={settings?.id ?? 'none'}
            defaultValue={s.displayName}
            onBlur={(e) => {
              const displayName = e.target.value.trim()
              if (displayName !== s.displayName) save({ displayName })
            }}
            autoComplete="given-name"
            className="min-h-12 rounded-lg border border-concreto bg-hierro px-4 text-arena"
          />
        </div>
        <ChoiceGroup
          label="Unidades de peso"
          choices={UNITS}
          value={s.unit}
          onChange={(unit) => save({ unit })}
        />
        <ChoiceGroup
          label="Objetivo semanal (días)"
          choices={GOALS}
          value={s.weeklyGoal}
          onChange={(weeklyGoal) => save({ weeklyGoal })}
        />
        <ChoiceGroup
          label="Descanso por defecto"
          choices={RESTS}
          value={s.defaultRestSec}
          onChange={(defaultRestSec) => save({ defaultRestSec })}
        />
        <ChoiceGroup
          label="Inicio de semana"
          choices={WEEK_STARTS}
          value={s.weekStart}
          onChange={(weekStart) => save({ weekStart })}
        />
      </Section>

      <Section title="Entreno">
        {TOGGLES.map(({ key, label }) => (
          <label
            key={key}
            className="flex min-h-12 cursor-pointer items-center justify-between gap-3"
          >
            <span>{label}</span>
            <input
              type="checkbox"
              role="switch"
              checked={s[key]}
              onChange={(e) => save({ [key]: e.target.checked })}
              className="size-6 accent-sol"
            />
          </label>
        ))}
      </Section>

      <Section title="Apariencia">
        <ChoiceGroup
          label="Tema"
          choices={THEMES}
          value={s.theme}
          onChange={(theme) => save({ theme })}
        />
      </Section>
    </>
  )
}
