import type { RouteObject } from 'react-router'
import { History } from './History'

/**
 * Routes under the Historial tab (`/historial`): V9. Session rows link to
 * `/historial/sesiones/:workoutId` (V8, mounted from features/sessions/routes).
 */
export const historyRoutes: RouteObject[] = [{ index: true, element: <History /> }]
