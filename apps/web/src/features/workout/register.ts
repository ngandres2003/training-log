import { registerActiveWorkoutUi, type ActiveWorkoutUi } from '../../app/active-workout-slot'
import { ActiveWorkoutLayer } from './ActiveWorkoutLayer'
import { MiniPlayer } from './MiniPlayer'

/** Fills the AppLayout slot for the active-workout layer and mini-player (imported from main.tsx). */
export const activeWorkoutUi: ActiveWorkoutUi = { Layer: ActiveWorkoutLayer, MiniPlayer }

registerActiveWorkoutUi(activeWorkoutUi)
