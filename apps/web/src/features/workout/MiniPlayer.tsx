import type { Workout } from '@training-log/domain'
import { Dumbbell } from 'lucide-react'
import { useState } from 'react'
import { remainingRestMs } from '../../pwa/notify'
import { Button } from '../../ui/Button'
import { ConfirmSheet } from '../routines/components/Sheet'
import { elapsedClock, restClock } from './format'
import { closeWorkout, openWorkout, useWorkoutUi } from './ui-store'
import { useActiveWorkout } from './use-active-workout'
import { useNow } from './use-now'
import { discardWorkout, isStale, saveStaleWorkout } from './workout-actions'

/**
 * Bottom-stack slot of the active workout, just above the tab bar:
 * - at app start (the workout was not opened in this page session), the F5 recovery banner;
 * - once minimized, a floating pill over the tab bar (chronometer, or remaining rest).
 * Nothing while V5 is expanded or when there is no active workout.
 */
export function MiniPlayer() {
  const workout = useActiveWorkout()
  const ui = useWorkoutUi()
  if (!workout || ui.expanded) return null
  return ui.touched ? <Player workout={workout} /> : <RecoveryBanner workout={workout} />
}

function Player({ workout }: { workout: Workout }) {
  const now = useNow()
  const rest = remainingRestMs(workout.restEndsAt, now)
  const resting = rest > 0
  const elapsed = elapsedClock(now - Date.parse(workout.startedAt))
  // A small floating pill over the bottom-right corner: the clock, or the rest countdown while
  // resting. The routine name stays in the accessible name.
  return (
    <button
      type="button"
      onClick={openWorkout}
      aria-label={`Volver al entreno ${workout.name}, ${elapsed}${resting ? `, descanso ${restClock(rest)}` : ''}`}
      className="neon absolute right-3 bottom-full mb-3 flex h-12 animate-rise items-center gap-2 rounded-full bg-asfalto pr-4 pl-1.5 transition-transform duration-150 active:scale-95"
    >
      <span
        aria-hidden="true"
        className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-sol text-tinta"
      >
        <span className="absolute inset-0 rounded-full bg-sol opacity-60 motion-safe:animate-ping [animation-duration:2s]" />
        <Dumbbell className="relative size-4" />
      </span>
      <span aria-hidden="true" className="flex flex-col items-start leading-none">
        {resting ? (
          <>
            <span className="text-[10px] font-bold tracking-wide text-polvo uppercase">Descanso</span>
            <span className="font-display text-lg text-acento">{restClock(rest)}</span>
          </>
        ) : (
          <span className="font-display text-lg text-acento">{elapsed}</span>
        )}
      </span>
    </button>
  )
}

/**
 * F5 · "Tienes un entreno en curso": Continuar (V5 with the real elapsed time) or Descartar.
 * A workout open more than 6 hours is also offered to be saved ending at its last set.
 */
function RecoveryBanner({ workout }: { workout: Workout }) {
  const now = useNow()
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const stale = isStale(workout, now)

  return (
    <section
      aria-labelledby="recovery-title"
      className="mx-2 flex flex-col gap-2 rounded-xl border border-sol/60 bg-asfalto p-3"
    >
      <div className="flex items-baseline gap-2">
        <h2 id="recovery-title" className="min-w-0 flex-1 font-bold">
          Tienes un entreno en curso
        </h2>
        <span className="shrink-0 font-display text-acento">{elapsedClock(now - Date.parse(workout.startedAt))}</span>
      </div>
      <p className="truncate text-sm text-polvo">{workout.name}</p>
      {stale && (
        <p className="text-sm">
          Lleva abierto más de 6 horas. Puedes guardarlo con la hora de la última serie como hora de fin.
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setConfirmDiscard(true)}>
          Descartar
        </Button>
        {stale && (
          <Button variant="secondary" className="flex-1" onClick={() => void saveStaleWorkout(workout.id)}>
            Guardar
          </Button>
        )}
        <Button className="flex-1" onClick={openWorkout}>
          Continuar
        </Button>
      </div>
      {confirmDiscard && (
        <ConfirmSheet
          title="¿Descartar entreno?"
          description="Se perderán las series de esta sesión."
          confirmLabel="Descartar"
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            setConfirmDiscard(false)
            closeWorkout()
            void discardWorkout(workout.id)
          }}
        />
      )}
    </section>
  )
}
