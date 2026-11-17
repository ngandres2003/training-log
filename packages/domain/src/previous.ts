import type { ExerciseSession } from './history'
import type { Id } from './types'
import type { SetValues } from './records'

export type Prefill = Pick<SetValues, 'weight' | 'reps' | 'durationSec'>

export interface PreviousRow {
  /** Row N of the last session; null renders as "—". */
  previous: SetValues | null
  /** Values to preload into today's row. RPE is never preloaded (R21). */
  prefill: Prefill | null
}

/** Most recent session of this exercise inside the given routine. */
export function lastRoutineSession(
  sessions: ExerciseSession[],
  routineId: Id,
): ExerciseSession | null {
  return sessions.findLast((s) => s.routineId === routineId) ?? null
}

/**
 * "Anterior" (R18): today's row N pairs with row N of the last session of this
 * routine, whatever the set types. Unpaired rows show "—" and preload the last
 * row of that session. No previous session means no values at all.
 */
export function pairPrevious(previousSets: SetValues[], todayRowCount: number): PreviousRow[] {
  const last = previousSets.at(-1)
  return Array.from({ length: todayRowCount }, (_, i) => {
    const previous = previousSets[i] ?? null
    const source = previous ?? last
    return {
      previous: previous && pick(previous),
      prefill: source
        ? { weight: source.weight, reps: source.reps, durationSec: source.durationSec }
        : null,
    }
  })
}

const pick = (s: SetValues): SetValues => ({
  type: s.type,
  weight: s.weight,
  reps: s.reps,
  durationSec: s.durationSec,
})
