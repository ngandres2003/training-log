import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { appRoutes } from './router'
import { ShellProvider, type ShellDeps } from './shell'

/** Renders the whole app (gate, layout, tabs) at `path` with injected services. */
export function renderApp(deps: Partial<ShellDeps>, path = '/') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  const result = render(
    <ShellProvider deps={deps}>
      <RouterProvider router={router} />
    </ShellProvider>,
  )
  return { ...result, router }
}
