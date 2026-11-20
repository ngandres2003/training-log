import { useSyncExternalStore, type ComponentType } from 'react'

/**
 * Slot for the active-workout layer and its mini-player (spec "Capas globales"), filled by U13.
 *
 * - `Layer` is rendered by AppLayout above every tab page (outside the tab routes). It renders
 *   the full-screen V5 when the workout is expanded and `null` otherwise.
 * - `MiniPlayer` is rendered in the bottom stack, floating just above the tab bar. It renders
 *   `null` when there is no active workout or while the layer is expanded.
 *
 * Both decide visibility themselves (e.g. from the `status: active` Workout in Dexie, KTD9).
 * Register once at module load from the feature, e.g.:
 *   registerActiveWorkoutUi({ Layer: ActiveWorkoutLayer, MiniPlayer: MiniPlayer })
 * and import that module from `src/main.tsx`.
 */
export interface ActiveWorkoutUi {
  Layer: ComponentType
  MiniPlayer: ComponentType
}

let current: ActiveWorkoutUi | null = null
const listeners = new Set<() => void>()

/** Registers the active-workout UI; returns an unregister function. */
export function registerActiveWorkoutUi(ui: ActiveWorkoutUi): () => void {
  current = ui
  listeners.forEach((l) => l())
  return () => {
    if (current !== ui) return
    current = null
    listeners.forEach((l) => l())
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useActiveWorkoutUi(): ActiveWorkoutUi | null {
  return useSyncExternalStore(subscribe, () => current)
}
