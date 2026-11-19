import type { RouteObject } from 'react-router'
import { ExerciseLibrary } from './ExerciseLibrary'

/** Child views of the Perfil tab (V12): the exercise library (V4, management mode). */
export const exercisesRoutes: RouteObject[] = [{ path: 'ejercicios', element: <ExerciseLibrary /> }]
