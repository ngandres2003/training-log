import type { RouteObject } from 'react-router'
import HistorialPlaceholder from './placeholders/HistorialPlaceholder'
import InicioPlaceholder from './placeholders/InicioPlaceholder'
import PerfilPlaceholder from './placeholders/PerfilPlaceholder'
import ProgresoPlaceholder from './placeholders/ProgresoPlaceholder'

/**
 * Pages rendered inside the signed-in layout (tab bar + sync indicator). A feature unit
 * registers its screens here: replace the tab's placeholder import with its page (and delete
 * the placeholder file), and add child views next to it, e.g.
 *   { path: 'rutinas/:routineId', element: <RoutineDetail /> }       // V2 under Inicio
 *   { path: 'historial/sesiones/:workoutId', element: <SessionDetail /> }
 * Every page starts with `<PageHeader title=… />` so the sync indicator stays in its header.
 * The active workout is not a route: it is a global layer (see ./active-workout-slot).
 */
export const tabRoutes: RouteObject[] = [
  { index: true, element: <InicioPlaceholder /> },
  { path: 'historial', element: <HistorialPlaceholder /> },
  { path: 'progreso', element: <ProgresoPlaceholder /> },
  { path: 'perfil', element: <PerfilPlaceholder /> },
]
