import { formatWeight, type Id } from '@training-log/domain'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSyncSnapshot, SyncIndicator } from '../../app/SyncIndicator'
import { indicatorState } from '../../data/sync/status'
import { remainingRestMs } from '../../pwa/notify'
import { keepScreenAwake } from '../../pwa/wake-lock'
import { Button } from '../../ui/Button'
import { useExerciseLookup } from '../exercises/catalog'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { Sheet } from '../routines/components/Sheet'
import { ExerciseBlock, type ExerciseBlockHandlers } from './ExerciseBlock'
import { onFinishRequested } from './finish-hook'
import { elapsedClock, restClock } from './format'
import { RestSheet } from './RestSheet'
import { closeRest, closeWorkout, minimizeWorkout, openRest, useWorkoutUi } from './ui-store'
import { useNow } from './use-now'
import { buildWorkoutModel, loadWorkoutData } from './view-model'
import {
  addExercises,
  addSet,
  adjustRest,
  completeSet,
  deleteSet,
  discardWorkout,
  removeExercise,
  replaceExercise,
  saveExerciseNote,
  saveExerciseRest,
  saveSet,
  skipRest,
  toggleSuperset,
  uncompleteSet,
} from './workout-actions'
import { useLayer } from '../../ui/layer'

type Picker = { kind: 'add' } | { kind: 'replace'; workoutExerciseId: Id }

function vibrate(ms: number) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms)
  } catch {
    // Not available on iOS; the ✓ and color still show the change.
  }
}

/** V5 · Entreno activo: header, exercise indicator, carousel of slides and the bottom bar. */
export function ActiveWorkout({ workoutId }: { workoutId: Id }) {
  const data = useLiveQuery(() => loadWorkoutData(workoutId), [workoutId])
  const lookup = useExerciseLookup()
  const ui = useWorkoutUi()
  // Back minimizes the workout, like the chevron.
  useLayer(minimizeWorkout)
  const now = useNow()
  const offline = indicatorState(useSyncSnapshot()).state === 'sin-conexion'
  const model = useMemo(() => (data ? buildWorkoutModel(data, lookup.byId) : null), [data, lookup.byId])

  const [current, setCurrent] = useState(0)
  const [picker, setPicker] = useState<Picker | null>(null)
  const [confirm, setConfirm] = useState<'finish' | 'discard' | null>(null)
  const slides = useRef<(HTMLElement | null)[]>([])
  const carousel = useRef<HTMLDivElement>(null)
  const follow = useRef<'next' | 'last' | null>(null)
  // Slide a button/✓ is gliding to. While set, the scroll positions passed on the way don't move
  // the highlight (it would flash through every slide in between); the user touching the carousel
  // or the glide ending releases it.
  const gliding = useRef<number | null>(null)

  const keepScreenOn = data?.settings.keepScreenOn ?? true
  useEffect(() => (keepScreenOn ? keepScreenAwake() : undefined), [keepScreenOn])

  const blockCount = model?.blocks.length ?? 0
  const goTo = (i: number) => {
    const target = Math.max(0, Math.min(i, blockCount - 1))
    const el = carousel.current
    const slide = slides.current[target]
    setCurrent(target)
    if (!el || !slide) return
    // Scroll only the carousel (scrollIntoView would also nudge any scrollable ancestor), centring
    // the slide like its snap point does. 'auto' follows the carousel's CSS scroll-behavior:
    // smooth, or instant with reduced motion.
    const left =
      el.scrollLeft +
      slide.getBoundingClientRect().left -
      el.getBoundingClientRect().left -
      (el.clientWidth - slide.offsetWidth) / 2
    const max = el.scrollWidth - el.clientWidth
    const clamped = Math.max(0, Math.min(left, max))
    if (Math.abs(clamped - el.scrollLeft) < 1) return
    gliding.current = target
    if (typeof el.scrollTo === 'function') el.scrollTo({ left: clamped, behavior: 'auto' })
    else el.scrollLeft = clamped
  }

  // After ✓ follow the next pending set to its slide; after adding exercises show the last one.
  useEffect(() => {
    if (!model || !follow.current) return
    const target = follow.current === 'last' ? model.blocks.length - 1 : model.next?.blockIndex
    follow.current = null
    if (target != null && target >= 0 && target !== current) goTo(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model])

  // Exercises were removed: keep the indicator on the last one.
  if (current > 0 && current >= blockCount) setCurrent(Math.max(0, blockCount - 1))

  // Loading (one live query): cover the page without announcing V5 until it has content.
  if (!model) return <div aria-hidden="true" className="fixed inset-0 z-40 bg-hierro" />


  const { workout, settings } = model
  const unit = settings.unit
  const remaining = remainingRestMs(workout.restEndsAt, now)
  const resting = remaining > 0
  const empty = model.exercises.length === 0
  const pendingSets = model.total - model.completed

  const handlers: ExerciseBlockHandlers = {
    onComplete: (exercise, set, values) => {
      if (settings.vibrationOn) vibrate(40)
      follow.current = 'next'
      void completeSet({ workoutId, setId: set.set.id, values, restSec: exercise.restSec }).then(() => {
        if (exercise.restSec != null && exercise.restSec > 0) openRest()
      })
    },
    onSave: (setId, patch) => void saveSet(setId, patch),
    onUncomplete: (setId) => void uncompleteSet(setId),
    onDeleteSet: (setId) => void deleteSet(setId),
    onAddSet: (weId) => void addSet(weId),
    onReplace: (weId) => setPicker({ kind: 'replace', workoutExerciseId: weId }),
    onRemove: (weId) => void removeExercise(weId),
    onToggleSuperset: (weId) => void toggleSuperset(workoutId, weId),
    onSaveNote: (weId, note) => void saveExerciseNote(weId, note),
    onSaveRest: (weId, restSec) => void saveExerciseRest(weId, restSec),
  }

  const exerciseIds = model.exercises.map((e) => e.we.id)
  const hasNextExercise = (weId: Id) => exerciseIds.indexOf(weId) < exerciseIds.length - 1

  const finish = () => {
    if (pendingSets > 0) setConfirm('finish')
    else onFinishRequested(workoutId)
  }

  /** Fractional slide index at the carousel's centre (0 = first slide centred). */
  const scrollPosition = () => {
    const el = carousel.current
    const first = slides.current[0]
    if (!el || !first || first.offsetWidth === 0) return null
    const second = slides.current[1]
    const stride = second ? second.offsetLeft - first.offsetLeft : first.offsetWidth
    if (stride <= 0) return null
    const firstCentre =
      el.scrollLeft + first.getBoundingClientRect().left - el.getBoundingClientRect().left + first.offsetWidth / 2
    return (el.scrollLeft + el.clientWidth / 2 - firstCentre) / stride
  }

  const onScroll = () => {
    const pos = scrollPosition()
    if (pos == null) return
    const nearest = Math.max(0, Math.min(Math.round(pos), blockCount - 1))
    if (gliding.current != null) {
      // Programmatic glide: hold the highlight on its destination until it gets there.
      if (nearest === gliding.current) gliding.current = null
      return
    }
    // A little hysteresis around the halfway point, so a finger resting there doesn't make the
    // two slides flicker between highlighted and receded. Snapping always lands on a whole index,
    // so the final slide is always picked up.
    if (nearest !== current && Math.abs(pos - current) > 0.6) setCurrent(nearest)
  }

  const onScrollEnd = () => {
    gliding.current = null
    const pos = scrollPosition()
    if (pos == null) return
    const nearest = Math.max(0, Math.min(Math.round(pos), blockCount - 1))
    if (nearest !== current) setCurrent(nearest)
  }

  // The user taking over mid-glide: follow their finger again.
  const releaseGlide = () => {
    gliding.current = null
  }

  const showRest = ui.restOpen && resting

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Entreno activo"
        aria-hidden={showRest || undefined}
        className="fixed inset-0 z-40 flex justify-center bg-hierro text-arena animate-slide-up"
      >
        <div className="flex h-full w-full max-w-[480px] flex-col">
          <header className="flex items-center gap-1 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1">
            <button
              type="button"
              aria-label="Minimizar entreno"
              onClick={minimizeWorkout}
              className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-lg text-arena"
            >
              <ChevronDown aria-hidden="true" className="size-7" />
            </button>
            <div className="flex min-w-0 flex-1 flex-col">
              <h1 className="truncate font-display text-xl leading-tight uppercase">{workout.name}</h1>
              <span className="font-display text-acento" aria-label="Tiempo total">
                {elapsedClock(now - Date.parse(workout.startedAt))}
              </span>
            </div>
            <SyncIndicator />
            <Button className="shrink-0 uppercase" disabled={empty} onClick={finish}>
              Finalizar
            </Button>
          </header>

          <div className="flex items-center gap-2 px-4 text-xs font-bold text-polvo uppercase">
            {empty ? (
              <span>Sin ejercicios</span>
            ) : (
              <>
                <span className="shrink-0 font-display text-sm text-arena">
                  EJ {Math.min(current + 1, blockCount)}/{blockCount}
                </span>
                <div className="flex min-w-0 flex-1 gap-1">
                  {model.blocks.map((b, i) => {
                    const sets = b.exercises.flatMap((e) => e.sets)
                    const done = sets.filter((s) => s.set.completed).length
                    const label = b.exercises.map((e) => e.name).join(' · ')
                    return (
                      <button
                        key={b.exercises[0]!.we.id}
                        type="button"
                        aria-label={`Ir al ejercicio ${i + 1}: ${label}`}
                        aria-current={i === current ? 'true' : undefined}
                        onClick={() => goTo(i)}
                        className="flex min-h-12 min-w-0 flex-1 items-center"
                      >
                        <span
                          className={`relative w-full overflow-hidden rounded-full transition-[height,background-color] duration-300 ease-suave ${
                            i === current ? 'h-2 bg-borde-activo' : 'h-1.5 bg-concreto'
                          }`}
                        >
                          <span
                            className={`absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-500 ease-suave ${
                              i === current ? 'bg-sol' : 'bg-polvo'
                            }`}
                            style={{ width: `${sets.length ? (done / sets.length) * 100 : 0}%` }}
                          />
                        </span>
                      </button>
                    )
                  })}
                </div>
                <span className="shrink-0">
                  {model.completed}/{model.total} series
                  {model.volume > 0 && <span className="normal-case"> · {formatWeight(model.volume, unit)}</span>}
                </span>
              </>
            )}
          </div>

          {offline && (
            <p role="status" className="mx-4 mb-1 rounded-lg border border-concreto px-3 py-2 text-sm">
              Sin conexión. Tu entreno se guarda en este móvil.
            </p>
          )}

          {empty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
              <span aria-hidden="true" className="font-display text-6xl text-concreto">
                0
              </span>
              <p className="font-display text-2xl uppercase">Aún no hay ejercicios</p>
              <Button onClick={() => setPicker({ kind: 'add' })} className="uppercase">
                <Plus aria-hidden="true" className="size-5" />
                Añadir ejercicio
              </Button>
              <Button variant="ghost" onClick={() => setConfirm('discard')}>
                Cancelar entreno
              </Button>
            </div>
          ) : (
            <div
              ref={carousel}
              onScroll={onScroll}
              onScrollEnd={onScrollEnd}
              onPointerDown={releaseGlide}
              onTouchStart={releaseGlide}
              onWheel={releaseGlide}
              aria-label="Ejercicios"
              role="region"
              className="scrollbar-none flex min-h-0 flex-1 snap-x snap-mandatory items-start gap-3 overflow-x-auto overscroll-x-contain scroll-smooth px-4 py-2"
            >
              {model.blocks.map((block, i) => (
                <ExerciseBlock
                  key={block.exercises[0]!.we.id}
                  ref={(el) => {
                    slides.current[i] = el
                  }}
                  current={i === current}
                  block={block}
                  position={i + 1}
                  count={blockCount}
                  unit={unit}
                  hasNextExercise={hasNextExercise}
                  handlers={handlers}
                  footer={
                    i === blockCount - 1 ? (
                      <Button variant="ghost" onClick={() => setConfirm('discard')}>
                        Cancelar entreno
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}

          <footer className="flex items-center gap-2 border-t border-concreto px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {resting ? (
              <div key="rest" className="flex flex-1 animate-rise items-center gap-2">
                <button
                  type="button"
                  onClick={openRest}
                  aria-label={`Descanso ${restClock(remaining)}, abrir temporizador`}
                  className="flex min-h-12 flex-1 items-center gap-3 rounded-lg bg-asfalto px-4"
                >
                  <span className="text-xs font-bold text-polvo uppercase">Descanso</span>
                  <span className="font-display text-2xl text-acento">{restClock(remaining)}</span>
                </button>
                <Button variant="secondary" aria-label="Sumar 15 segundos" onClick={() => void adjustRest(workoutId, 15)}>
                  +15
                </Button>
              </div>
            ) : (
              <div key="nav" className="flex flex-1 animate-rise items-center gap-2">
                <Button variant="secondary" className="flex-1 uppercase" onClick={() => setPicker({ kind: 'add' })}>
                  <Plus aria-hidden="true" className="size-5" />
                  Añadir ejercicio
                </Button>
              </div>
            )}
          </footer>
        </div>
      </div>

      {showRest && (
        <RestSheet
          model={model}
          remainingMs={remaining}
          onBack={closeRest}
          onAdjust={(delta) => void adjustRest(workoutId, delta)}
          onSkip={() => {
            closeRest()
            void skipRest(workoutId)
          }}
          onFinish={() => onFinishRequested(workoutId)}
          onAddExercise={() => {
            closeRest()
            setPicker({ kind: 'add' })
          }}
        />
      )}

      {picker && (
        <ExercisePicker
          excludeIds={picker.kind === 'add' ? model.exercises.map((e) => e.we.exerciseId) : []}
          onCancel={() => setPicker(null)}
          onConfirm={(ids) => {
            setPicker(null)
            if (picker.kind === 'replace') {
              if (ids[0]) void replaceExercise(picker.workoutExerciseId, ids[0])
              return
            }
            follow.current = 'last'
            void addExercises(workoutId, ids)
          }}
        />
      )}

      {confirm === 'finish' && (
        <Sheet
          title="¿Finalizar entreno?"
          description={`Tienes ${pendingSets} ${pendingSets === 1 ? 'serie' : 'series'} sin marcar. No contarán en el entreno.`}
          alert
          onClose={() => setConfirm(null)}
        >
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" autoFocus onClick={() => setConfirm(null)}>
              Seguir entrenando
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setConfirm(null)
                onFinishRequested(workoutId)
              }}
            >
              Finalizar
            </Button>
          </div>
        </Sheet>
      )}

      {confirm === 'discard' && (
        <Sheet
          title="¿Descartar entreno?"
          description="Se perderán las series de esta sesión."
          alert
          onClose={() => setConfirm(null)}
        >
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" autoFocus onClick={() => setConfirm(null)}>
              Seguir entrenando
            </Button>
            <Button
              className="flex-1 !bg-[#e05d5d] !text-arena"
              onClick={() => {
                setConfirm(null)
                closeWorkout()
                void discardWorkout(workoutId)
              }}
            >
              Descartar
            </Button>
          </div>
        </Sheet>
      )}
    </>
  )
}
