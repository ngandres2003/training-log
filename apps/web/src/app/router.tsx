import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router'
import { AppLayout } from './AppLayout'
import { AuthGate } from './auth-gate'
import { tabRoutes } from './routes'

/** Route tree: auth gate (VA / V0) → signed-in layout → tab pages from ./routes. */
export const appRoutes: RouteObject[] = [
  {
    element: (
      <AuthGate>
        <Outlet />
      </AuthGate>
    ),
    children: [
      { element: <AppLayout />, children: tabRoutes },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

export function createAppRouter() {
  return createBrowserRouter(appRoutes)
}
