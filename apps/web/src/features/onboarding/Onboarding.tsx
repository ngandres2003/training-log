import type { Settings, WeightUnit } from '@training-log/domain'
import { useId, useState, useSyncExternalStore } from 'react'
import { DEFAULT_SETTINGS, saveSettings } from '../../data/repositories/settings'
import { nowIso } from '../../data/ids'
import {
  currentInstallGuidance,
  IOS_INSTALL_INSTRUCTIONS,
  promptInstall,
  subscribeInstallGuidance,
} from '../../pwa/install-prompt'
import { notificationPermission, requestNotificationPermission } from '../../pwa/notify'
import { Button } from '../../ui/Button'
import { ChoiceGroup } from '../../ui/ChoiceGroup'

const UNITS = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
] as const satisfies readonly { value: WeightUnit; label: string }[]

const GOALS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }))

export interface OnboardingProps {
  /** Existing settings on this device, if any; otherwise the defaults are used. */
  initial?: Settings
  onDone: () => void
}

/** V0 · Onboarding: 3 steps, once per user (until `Settings.onboardedAt` is set). */
export function Onboarding({ initial, onDone }: OnboardingProps) {
  const base = initial ?? DEFAULT_SETTINGS
  const nameId = useId()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [unit, setUnit] = useState<WeightUnit>(base.unit)
  const [displayName, setDisplayName] = useState(base.displayName)
  const [weeklyGoal, setWeeklyGoal] = useState(base.weeklyGoal)
  const [saving, setSaving] = useState(false)

  async function finish() {
    setSaving(true)
    await saveSettings({ unit, displayName: displayName.trim(), weeklyGoal, onboardedAt: nowIso() })
    onDone()
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-6 bg-hierro px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-arena">
      <p className="text-sm text-polvo" aria-live="polite">
        Paso {step} de 3
      </p>

      {step === 1 && (
        <section className="flex flex-col gap-6">
          <h1 className="font-display text-4xl uppercase">Unidades y nombre</h1>
          <ChoiceGroup label="Unidades de peso" choices={UNITS} value={unit} onChange={setUnit} />
          <div className="flex flex-col gap-2">
            <label htmlFor={nameId} className="text-sm text-polvo">
              Nombre
            </label>
            <input
              id={nameId}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="given-name"
              placeholder="Cómo quieres que te llamemos"
              className="min-h-12 rounded-lg border border-concreto bg-asfalto px-4 text-arena placeholder:text-polvo"
            />
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-6">
          <h1 className="font-display text-4xl uppercase">Tu objetivo</h1>
          <ChoiceGroup label="Días por semana" choices={GOALS} value={weeklyGoal} onChange={setWeeklyGoal} />
        </section>
      )}

      {step === 3 && <InstallStep />}

      <div className="mt-auto flex gap-3">
        {step > 1 && (
          <Button variant="secondary" onClick={() => setStep((s) => (s - 1) as 1 | 2)}>
            Atrás
          </Button>
        )}
        {step < 3 ? (
          <Button className="flex-1" onClick={() => setStep((s) => (s + 1) as 2 | 3)}>
            Siguiente
          </Button>
        ) : (
          <Button className="flex-1" disabled={saving} onClick={() => void finish()}>
            Empezar
          </Button>
        )}
      </div>
    </main>
  )
}

const PERMISSION_TEXT: Record<Exclude<NotificationPermission, 'default'> | 'unsupported', string> = {
  granted: 'Notificaciones activadas.',
  denied: 'Notificaciones bloqueadas. Puedes activarlas en los ajustes del navegador.',
  unsupported: 'Este navegador no permite notificaciones aquí. En iPhone, instala la app primero.',
}

/** V0 step 3: install guidance (U8) and the notification permission for rest end. */
function InstallStep() {
  const guidance = useSyncExternalStore(subscribeInstallGuidance, currentInstallGuidance)
  const [permission, setPermission] = useState(notificationPermission)

  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-display text-4xl uppercase">Instala la app</h1>

      {guidance === 'installed' && <p className="text-polvo">La app ya está instalada en este dispositivo.</p>}
      {guidance === 'prompt' && (
        <>
          <p className="text-polvo">Añádela a la pantalla de inicio para abrirla como una app, también sin señal.</p>
          <Button variant="secondary" onClick={() => void promptInstall()}>
            Añadir a pantalla de inicio
          </Button>
        </>
      )}
      {guidance === 'ios-instructions' && (
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-polvo">
          {IOS_INSTALL_INSTRUCTIONS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      )}
      {guidance === 'unavailable' && (
        <p className="text-polvo">
          Usa «Instalar app» o «Añadir a pantalla de inicio» en el menú del navegador para abrirla como una app.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-polvo">Te avisamos cuando termine el descanso, aunque la pantalla esté apagada.</p>
        {permission === 'default' ? (
          <Button variant="secondary" onClick={() => void requestNotificationPermission().then(setPermission)}>
            Activar notificaciones
          </Button>
        ) : (
          <p role="status" className="text-sm text-polvo">
            {PERMISSION_TEXT[permission]}
          </p>
        )}
      </div>
    </section>
  )
}
