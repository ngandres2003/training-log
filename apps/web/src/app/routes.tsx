import type { RouteObject } from 'react-router'
import { exercisesRoutes } from '../features/exercises/routes'
import { profileRoutes } from '../features/profile/routes'
import { routinesRoutes } from '../features/routines/routes'
import HistorialPlaceholder from './placeholders/HistorialPlaceholder'
import ProgresoPlaceholder from './placeholders/ProgresoPlaceholder'

/** Prefixes a feature's routes with its tab path ('' for Inicio). */
function underTab(tab: string, routes: RouteObject[]): RouteObject[] {
  if (!tab) return routes
  return routes.map((route) =>
    route.index ? { ...route, index: undefined, path: tab } : { ...route, path: `${tab}/${route.path}` },
  ) as RouteObject[]
}

/**
 * Pages rendered inside the signed-in layout (tab bar + sync indicator). Each feature exports
 * its routes relative to its tab; they are mounted here. Every page starts with
 * `<PageHeader title=… />` so the sync indicator stays in its header. The active workout is not
 * a route: it is a global layer (see ./active-workout-slot).
 */
export const tabRoutes: RouteObject[] = [
  ...underTab('', routinesRoutes),
  { path: 'historial', element: <HistorialPlaceholder /> },
  { path: 'progreso', element: <ProgresoPlaceholder /> },
  ...underTab('perfil', profileRoutes),
  ...underTab('perfil', exercisesRoutes),
]
