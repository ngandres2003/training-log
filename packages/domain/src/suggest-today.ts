import type { Folder, Id, Routine, Workout } from './types'

const isActive = (r: Routine) => !r.archived && !r.deletedAt
const byOrder = (a: { order: number }, b: { order: number }) => a.order - b.order

/**
 * "Toca hoy" (R10).
 * - With cycle folders: the routine after the last one trained in the cycle trained
 *   most recently, wrapping around and skipping archived routines. If no cycle has
 *   been trained yet, the first active routine of the first cycle folder.
 * - Otherwise: the active routine whose last workout is oldest; never-done routines
 *   come first, in routine order.
 * Archived and deleted routines are never suggested.
 */
export function suggestToday(input: {
  folders: Folder[]
  routines: Routine[]
  workouts: Workout[]
}): Routine | null {
  const routines = input.routines.filter((r) => !r.deletedAt)
  const lastDone = new Map<Id, number>()
  for (const w of input.workouts) {
    if (w.status !== 'finished' || w.deletedAt || !w.routineId) continue
    const t = Date.parse(w.startedAt)
    if (t > (lastDone.get(w.routineId) ?? -Infinity)) lastDone.set(w.routineId, t)
  }

  const cycles = input.folders
    .filter((f) => f.isCycle && !f.deletedAt)
    .sort(byOrder)
    .map((f) => routines.filter((r) => r.folderId === f.id).sort(byOrder))
    .filter((list) => list.some(isActive))

  if (cycles.length > 0) {
    let latest: { cycle: Routine[]; index: number; at: number } | null = null
    for (const cycle of cycles) {
      cycle.forEach((r, index) => {
        const at = lastDone.get(r.id)
        if (at !== undefined && (!latest || at > latest.at)) latest = { cycle, index, at }
      })
    }
    if (!latest) return cycles[0]!.find(isActive)!
    const { cycle, index } = latest as { cycle: Routine[]; index: number }
    for (let step = 1; step <= cycle.length; step++) {
      const next = cycle[(index + step) % cycle.length]!
      if (isActive(next)) return next
    }
  }

  const candidates = routines.filter(isActive).sort(byOrder)
  let pick: Routine | null = null
  let pickAt = Infinity
  for (const r of candidates) {
    const at = lastDone.get(r.id) ?? -Infinity
    if (at < pickAt) {
      pick = r
      pickAt = at
    }
  }
  return pick
}
