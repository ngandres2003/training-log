import type { RouteObject } from 'react-router'
import { ExerciseDetail } from './ExerciseDetail'
import { Progress } from './Progress'

/**
 * Routes under the Progreso tab (`/progreso`): V10 (index) and V11. The active-workout chip
 * links to `/progreso/ejercicios/:exerciseId`, so V11 must keep that path.
 */
export const progressRoutes: RouteObject[] = [
  { index: true, element: <Progress /> },
  { path: 'ejercicios/:exerciseId', element: <ExerciseDetail /> },
]
