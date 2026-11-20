import { formatWeight, type WeightUnit } from '@training-log/domain'
import { minutesDelta, minutesText, percentDelta } from './format'
import type { SessionSummary as Summary } from './session-data'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-xl border border-concreto bg-asfalto px-3 py-2">
      <dt className="text-sm text-polvo">{label}</dt>
      <dd className="font-display text-2xl">{value}</dd>
    </div>
  )
}

/** Summary of V7 and V8: duration, volume, sets, reps, PRs and the comparison with last time. */
export function SessionSummary({ summary, unit }: { summary: Summary; unit: WeightUnit }) {
  const { comparison } = summary
  const deltas = comparison
    ? [
        comparison.volumePct != null ? `Volumen ${percentDelta(comparison.volumePct)}` : null,
        comparison.durationMs != null ? `Duración ${minutesDelta(comparison.durationMs)}` : null,
      ].filter(Boolean)
    : []
  return (
    <section aria-label="Resumen" className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-2">
        <Stat label="Duración" value={summary.durationMs != null ? minutesText(summary.durationMs) : '—'} />
        <Stat label="Volumen" value={formatWeight(summary.volume, unit)} />
        <Stat label="Series" value={String(summary.sets)} />
        <Stat label="Reps" value={String(summary.reps)} />
        <Stat label="PRs" value={String(summary.prs)} />
      </dl>
      {deltas.length > 0 && <p className="text-sm text-polvo">Frente a la sesión anterior: {deltas.join(' · ')}</p>}
    </section>
  )
}
