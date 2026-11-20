import type { ReactNode } from 'react'

/** Superset slide frame (design: Sol border, darker fill, "Superserie" label). */
export function SupersetGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 neon rounded-xl bg-fondo-superserie p-2">
      <span className="text-xs font-bold tracking-wide text-acento uppercase">Superserie</span>
      {children}
    </div>
  )
}
