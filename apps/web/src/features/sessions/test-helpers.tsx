import { render } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { activeWorkoutUi } from '../workout/register'
import { sessionsRoutes } from './routes'

/**
 * Renders V8 and its edit sub-route under `/historial` (as app/routes mounts them), the global
 * workout layer, and stubs for Inicio and the V9 list so navigation can be asserted.
 */
export function renderSessions(path: string) {
  const { Layer } = activeWorkoutUi
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <>
            <Outlet />
            <Layer />
          </>
        ),
        children: [
          { index: true, element: <h1>Inicio</h1> },
          { path: 'historial', element: <h1>Historial</h1> },
          ...sessionsRoutes.map((r) => ({ ...r, path: `historial/${r.path}` })),
        ],
      },
    ],
    { initialEntries: [path] },
  )
  return { ...render(<RouterProvider router={router} />), router }
}
