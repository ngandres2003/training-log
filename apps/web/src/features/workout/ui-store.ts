import { useSyncExternalStore } from 'react'

/**
 * Ephemeral UI state of the active-workout layer (KTD9: the workout itself lives in Dexie).
 * - `expanded`: V5 is full screen; otherwise the mini-player shows.
 * - `restOpen`: V6 is shown over V5 while a rest runs.
 * - `touched`: the workout was opened or minimized in this page session. Until then an active
 *   workout found at app start is offered through the recovery banner (F5).
 * - `finishing`: V7 (Finalizar entreno) is shown in place of V5.
 * - `celebrating`: id of the workout just saved, while its celebration screen shows (U14).
 */
export interface WorkoutUiState {
  expanded: boolean
  restOpen: boolean
  touched: boolean
  finishing: boolean
  celebrating: string | null
}

const INITIAL: WorkoutUiState = {
  expanded: false,
  restOpen: false,
  touched: false,
  finishing: false,
  celebrating: null,
}

let state = INITIAL
const listeners = new Set<() => void>()

function set(patch: Partial<WorkoutUiState>) {
  const next = { ...state, ...patch }
  if ((Object.keys(next) as (keyof WorkoutUiState)[]).every((k) => next[k] === state[k])) return
  state = next
  listeners.forEach((l) => l())
}

export const openWorkout = () => set({ expanded: true, touched: true })
export const minimizeWorkout = () => set({ expanded: false, restOpen: false, touched: true })
export const openRest = () => set({ restOpen: true })
export const closeRest = () => set({ restOpen: false })
/** V7 over the active workout; it stays expanded so the mini-player keeps out of the way. */
export const openFinish = () => set({ finishing: true, expanded: true, restOpen: false, touched: true })
/** "Volver al entreno" from V7. */
export const closeFinish = () => set({ finishing: false })
/** After the workout is finished or discarded. */
export const closeWorkout = () => set({ expanded: false, restOpen: false, finishing: false, touched: true })
/** Shows the celebration of the workout just saved (V7 → celebración → V1). */
export const celebrate = (workoutId: string) => set({ celebrating: workoutId })
export const closeCelebration = () => set({ celebrating: null })

export function getWorkoutUi(): WorkoutUiState {
  return state
}

/** Test hook: back to the page-load state. */
export function resetWorkoutUi(): void {
  state = INITIAL
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useWorkoutUi(): WorkoutUiState {
  return useSyncExternalStore(subscribe, getWorkoutUi)
}
