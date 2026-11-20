import type { ReactElement } from 'react'
import { ResponsiveContainer } from 'recharts'

/** Shared Recharts styling: recessive axes and grid, tooltip on the card surface. */
export const AXIS_TICK = { fill: 'var(--polvo)', fontSize: 12 }
export const TOOLTIP_PROPS = {
  contentStyle: {
    background: 'var(--asfalto)',
    border: '1px solid var(--borde-fuerte)',
    borderRadius: 8,
  },
  labelStyle: { color: 'var(--polvo)' },
  itemStyle: { color: 'var(--arena)' },
  cursor: { fill: 'var(--concreto)', opacity: 0.4 },
} as const

export interface ChartFigureProps {
  title: string
  /** Text alternative read by screen readers instead of the chart. */
  summary: string
  height?: number
  children: ReactElement
}

/** A titled card holding one responsive chart. */
export function ChartFigure({ title, summary, height = 160, children }: ChartFigureProps) {
  return (
    <figure aria-label={title} className="rounded-xl border border-concreto bg-asfalto p-3">
      <figcaption className="mb-2 text-sm text-polvo">{title}</figcaption>
      <p className="sr-only">{summary}</p>
      <div aria-hidden="true" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height }}>
          {children}
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
