import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router'
import { AppLayout } from './AppLayout'
import { InvitationPage } from '../features/auth/InvitationPage'
import { AuthGate } from './auth-gate'
import { tabRoutes } from './routes'

/**
 * Route tree: the public invitation page (works signed out, on a fresh device), then the auth
 * gate (VA / V0) → signed-in layout → tab pages from ./routes.
 */
export const appRoutes: RouteObject[] = [
  { path: 'invitacion/:token', element: <InvitationPage /> },
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
