import { useSyncExternalStore } from 'react'

/**
 * Ephemeral UI state of the active-workout layer (KTD9: the workout itself lives in Dexie).
 * - `expanded`: V5 is full screen; otherwise the mini-player shows.
 * - `restOpen`: V6 is shown over V5 while a rest runs.
 * - `touched`: the workout was opened or minimized in this page session. Until then an active
 *   workout found at app start is offered through the recovery banner (F5).
 */
export interface WorkoutUiState {
  expanded: boolean
  restOpen: boolean
  touched: boolean
}

const INITIAL: WorkoutUiState = { expanded: false, restOpen: false, touched: false }

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
/** After the workout is finished or discarded. */
export const closeWorkout = () => set({ expanded: false, restOpen: false, touched: true })

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
