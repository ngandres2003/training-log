/** Weekly goal ring for the V1 header, e.g. 3/4 días. */
export function WeekRing({ done, goal }: { done: number; goal: number }) {
  const r = 22
  const circumference = 2 * Math.PI * r
  const ratio = goal > 0 ? Math.min(done / goal, 1) : 0
  const met = done >= goal
  return (
    <div
      role="img"
      aria-label={`Objetivo semanal: ${done} de ${goal} días${met ? ', cumplido' : ''}`}
      className="relative size-14 shrink-0"
    >
      <svg viewBox="0 0 56 56" className="size-14 -rotate-90" aria-hidden="true">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" className="stroke-concreto" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="stroke-sol"
        />
      </svg>
      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-display text-base">
        {met ? '✓' : `${done}/${goal}`}
      </span>
    </div>
  )
}
