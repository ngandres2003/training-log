import type { RouteObject } from 'react-router'
import { ArchivedRoutines } from './ArchivedRoutines'
import { Home } from './Home'
import { RoutineDetail } from './RoutineDetail'
import { RoutineEditor } from './RoutineEditor'

/** Starting or resuming a workout from the Inicio tab: opens V5 (see ./start-workout). */
export { onStartRoutine } from './start-workout'

/** Inicio tab: V1 (index), V2, V3 (new / edit) and the archived routines list. */
export const routinesRoutes: RouteObject[] = [
  { index: true, element: <Home /> },
  { path: 'rutinas/nueva', element: <RoutineEditor /> },
  { path: 'rutinas/archivadas', element: <ArchivedRoutines /> },
  { path: 'rutinas/:routineId', element: <RoutineDetail /> },
  { path: 'rutinas/:routineId/editar', element: <RoutineEditor /> },
]
