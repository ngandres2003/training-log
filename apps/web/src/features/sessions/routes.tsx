import type { RouteObject } from 'react-router'
import { EditSession } from './EditSession'
import { SessionDetail } from './SessionDetail'

/** Routes under the Historial tab: V8 (`sesiones/:workoutId`, linked from V9 and V2) and its editor. */
export const sessionsRoutes: RouteObject[] = [
  { path: 'sesiones/:workoutId', element: <SessionDetail /> },
  { path: 'sesiones/:workoutId/editar', element: <EditSession /> },
]
