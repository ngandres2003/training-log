import type { Routine } from '@training-log/domain'
import { Play } from 'lucide-react'
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Menu, type MenuItem } from './components/Menu'
import { relativeDay } from './format'

export interface RoutineCardInfo {
  routine: Routine
  exerciseNames: string[]
  lastDoneAt: string | null
  avgMinutes: number | null
}

/** V1 routine card: name, color, exercises, last time, mean duration, ▶ Iniciar and the ⋯ menu. */
export function RoutineCard({
  info,
  position,
  highlighted = false,
  menu,
  onStart,
  extra,
}: {
  info: RoutineCardInfo
  /** 1-based position in a cycle folder. */
  position?: number
  highlighted?: boolean
  menu: MenuItem[]
  onStart: () => void
  /** Extra controls, e.g. reorder buttons. */
  extra?: ReactNode
}) {
  const { routine, exerciseNames, lastDoneAt, avgMinutes } = info
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView?.({ block: 'center' })
  }, [highlighted])

  const shortList = exerciseNames.slice(0, 3).join(', ') + (exerciseNames.length > 3 ? '…' : '')
  const n = exerciseNames.length

  return (
    <article
      ref={ref}
      aria-label={routine.name}
      data-highlighted={highlighted ? 'true' : undefined}
      className={`flex overflow-hidden rounded-xl bg-asfalto transition-shadow duration-300 ${
        highlighted ? 'neon ring-2 ring-sol' : 'neon-soft'
      }`}
      style={{ '--neon': routine.color } as CSSProperties}
    >
      <span aria-hidden="true" className="w-1.5 shrink-0" style={{ backgroundColor: routine.color }} />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <Link to={`rutinas/${routine.id}`} className="flex min-h-12 min-w-0 flex-1 flex-col justify-center gap-0.5">
            <h3 className="truncate text-lg leading-tight font-bold">
              {position !== undefined && <span className="mr-1 font-display text-acento">{position}.</span>}
              {routine.name}
            </h3>
            <p className="truncate text-sm text-polvo">
              {n === 1 ? '1 ejercicio' : `${n} ejercicios`}
              {shortList && ` · ${shortList}`}
            </p>
          </Link>
          {/* Pulled into the corner padding: the 48px target stays, the ⋯ glyph lines up with the title and Iniciar. */}
          <div className="-mt-3 -mr-3 shrink-0">
            <Menu label={`Opciones de ${routine.name}`} items={menu} />
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-concreto/60 pt-3">
          <p className="min-w-0 flex-1 text-sm leading-snug text-polvo">
            {lastDoneAt ? `Última vez ${relativeDay(lastDoneAt)}` : 'Aún sin hacer'}
            {avgMinutes != null && ` · ${avgMinutes} min de media`}
          </p>
          <button
            type="button"
            onClick={onStart}
            aria-label={`Iniciar ${routine.name}`}
            className="inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-lg bg-sol px-5 font-bold text-tinta"
          >
            <Play aria-hidden="true" className="size-4 fill-current" />
            Iniciar
          </button>
        </div>
        {extra}
      </div>
    </article>
  )
}
