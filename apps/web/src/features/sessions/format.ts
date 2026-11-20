/** "45 min" */
export const minutesText = (ms: number) => `${Math.max(0, Math.round(ms / 60_000))} min`

const signed = (n: number, text: string) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${text}`

/** "+4,2 %", "−3 %", "0 %" (one decimal at most). */
export function percentDelta(pct: number): string {
  const rounded = Math.round(pct * 10) / 10
  return signed(rounded, `${String(Math.abs(rounded)).replace('.', ',')} %`)
}

/** "+3 min", "−5 min" */
export function minutesDelta(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  return signed(minutes, `${Math.abs(minutes)} min`)
}

/** Quick tags of V7's sensations (spec V7). */
export const SESSION_TAGS = ['Dormí mal', 'Con dolor', 'Gran pump', 'Poco tiempo'] as const

/** Energy 1–5 faces, worst to best. */
export const ENERGY_FACES = ['😫', '😕', '😐', '🙂', '😄'] as const
