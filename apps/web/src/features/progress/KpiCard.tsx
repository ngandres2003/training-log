import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

export interface KpiCardProps {
  label: string
  value: string
  /** Signed change against the previous period, already formatted; hidden when null. */
  delta?: string | null
  /** Direction of the change, shown as an icon so it is not color alone. */
  trend?: 'up' | 'down' | 'flat'
}

const ICONS = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus }

/** One V10 KPI tile: value plus its Δ against the previous period. */
export function KpiCard({ label, value, delta = null, trend = 'flat' }: KpiCardProps) {
  const Icon = ICONS[trend]
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col gap-1 rounded-xl border border-concreto bg-asfalto px-4 py-3"
    >
      <span className="text-sm text-polvo">{label}</span>
      <span className="font-display text-2xl">{value}</span>
      {delta != null && (
        <span className="flex items-center gap-1 text-sm text-polvo">
          <Icon aria-hidden="true" className="size-4" />
          <span>{delta} vs. periodo anterior</span>
        </span>
      )}
    </div>
  )
}

export const trendOf = (delta: number | null): KpiCardProps['trend'] =>
  delta == null || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down'
