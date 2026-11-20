import type { ReactNode } from 'react'

/** Superset slide frame (design: Sol border, darker fill, "Superserie" label). */
export function SupersetGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-sol bg-fondo-superserie p-2">
      <span className="text-xs font-bold tracking-wide text-sol uppercase">Superserie</span>
      {children}
    </div>
  )
}
