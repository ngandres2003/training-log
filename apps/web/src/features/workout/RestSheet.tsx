import { ChevronLeft } from 'lucide-react'
import { SyncIndicator } from '../../app/SyncIndicator'
import { Button } from '../../ui/Button'
import { compactSet, fullSet, restClock } from './format'
import { alternation, type WorkoutModel } from './view-model'

const RING = 248
const STROKE = 10
const R = (RING - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * R

/**
 * V6 · Descanso, full screen over V5 (design). Countdown ring, −15 s / +15 s / OMITIR and the
 * "Siguiente" card, which follows the superset alternation A1 → B1 → A2 (R20).
 */
export function RestSheet({
  model,
  remainingMs,
  onBack,
  onAdjust,
  onSkip,
  onFinish,
  onAddExercise,
}: {
  model: WorkoutModel
  remainingMs: number
  onBack: () => void
  onAdjust: (deltaSec: number) => void
  onSkip: () => void
  onFinish: () => void
  onAddExercise: () => void
}) {
  const unit = model.settings.unit
  const last = model.lastCompleted
  const restEndsAt = model.workout.restEndsAt
  // The rest started when the last set was checked; ±15 s moves only the end.
  const totalMs =
    last?.set.set.completedAt && restEndsAt
      ? Math.max(remainingMs, Date.parse(restEndsAt) - Date.parse(last.set.set.completedAt))
      : remainingMs
  const fraction = totalMs > 0 ? remainingMs / totalMs : 0
  const next = model.next

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rest-title"
      className="fixed inset-0 z-[45] overflow-y-auto bg-hierro text-arena"
    >
      <div className="mx-auto flex min-h-full max-w-[480px] flex-col gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center gap-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button
            type="button"
            aria-label="Volver al entreno"
            onClick={onBack}
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg text-arena"
          >
            <ChevronLeft aria-hidden="true" className="size-7" />
          </button>
          <h2 id="rest-title" className="min-w-0 flex-1 font-display text-3xl uppercase">
            Descanso
          </h2>
          <SyncIndicator />
        </header>

        {last && (
          <p className="flex items-center gap-2 rounded-xl bg-asfalto px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">
              {last.exercise.letter && `${last.exercise.letter}${last.set.index + 1} · `}
              {last.exercise.name} · {fullSet(last.set.set, last.exercise.trackingType, unit)}
            </span>
            {last.set.pr && <span className="shrink-0 rounded bg-atardecer px-1.5 font-bold text-tinta">PR</span>}
          </p>
        )}

        <div className="relative mx-auto" style={{ width: RING, height: RING }}>
          <svg width={RING} height={RING} aria-hidden="true" className="-rotate-90">
            <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" strokeWidth={STROKE} className="stroke-concreto" />
            <circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
              className="stroke-sol"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-[88px] leading-none" aria-label={`Quedan ${restClock(remainingMs)}`}>
              {restClock(remainingMs)}
            </span>
            <span className="text-polvo">de {restClock(totalMs)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" aria-label="Restar 15 segundos" onClick={() => onAdjust(-15)}>
            −15 s
          </Button>
          <Button variant="secondary" className="flex-1" aria-label="Sumar 15 segundos" onClick={() => onAdjust(15)}>
            +15 s
          </Button>
        </div>
        <Button variant="ghost" className="uppercase" onClick={onSkip}>
          Omitir descanso
        </Button>

        {next ? (
          <NextCard model={model} />
        ) : (
          <section aria-label="Entreno completado" className="flex flex-col gap-3 rounded-xl bg-asfalto p-4">
            <p>Has completado las {model.completed} series de este entreno.</p>
            <Button className="uppercase" onClick={onFinish}>
              Finalizar entreno
            </Button>
            <Button variant="secondary" className="uppercase" onClick={onAddExercise}>
              Añadir ejercicio
            </Button>
          </section>
        )}
      </div>
    </div>
  )
}

function NextCard({ model }: { model: WorkoutModel }) {
  const next = model.next!
  const unit = model.settings.unit
  const { exercise, set } = next
  const block = model.blocks[next.blockIndex]!
  const name = exercise.letter ? `${exercise.letter}${next.round}` : null
  const title = name ? `Siguiente · ${name}, ronda ${next.round} de ${next.rounds}` : 'Siguiente'

  return (
    <section aria-label={title} className="flex flex-col gap-2 rounded-xl bg-asfalto p-4">
      <h3 className="text-xs font-bold tracking-wide text-polvo uppercase">{title}</h3>
      {block.superset && (
        <ol className="flex flex-wrap gap-1" aria-label="Secuencia">
          {alternation(block).map((r) => {
            const label = `${r.exercise.letter}${r.set.index + 1}`
            const current = r.set.set.id === set.set.id
            return (
              <li
                key={r.set.set.id}
                aria-current={current ? 'step' : undefined}
                className={`rounded px-2 py-0.5 font-display text-sm ${
                  current ? 'bg-sol text-tinta' : r.set.set.completed ? 'text-polvo line-through' : 'text-arena'
                }`}
              >
                {label}
                {r.set.set.completed && <span className="sr-only"> (hecha)</span>}
              </li>
            )
          })}
        </ol>
      )}
      {!name && (
        <p className="font-display text-xl">
          Serie {next.round} de {next.rounds}
        </p>
      )}
      <p className="line-clamp-2 text-lg font-bold">{exercise.name}</p>
      <p className="font-display text-2xl">{fullSet(set.effective, exercise.trackingType, unit)}</p>
      <p className="text-sm text-polvo">
        Anterior {set.previous ? compactSet(set.previous, exercise.trackingType, unit) : '—'}
      </p>
    </section>
  )
}
