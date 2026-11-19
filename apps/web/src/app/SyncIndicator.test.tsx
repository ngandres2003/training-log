import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { createSyncStatusStore, type SyncFlags } from '../data/sync/status'
import { SyncIndicator } from './SyncIndicator'

function renderIndicator(flags: Partial<SyncFlags>) {
  const store = createSyncStatusStore({ online: true, ...flags })
  const router = createMemoryRouter([{ path: '*', element: <SyncIndicator store={store} /> }])
  render(<RouterProvider router={router} />)
  return screen.getByRole('link', { name: /^Sincronización/ })
}

afterEach(cleanup)

describe('SyncIndicator (R6)', () => {
  it.each([
    ['synced', {}, 'Sincronización: sincronizado', 'sincronizado'],
    ['pending', { pendingCount: 2 }, 'Sincronización: pendiente, 2 cambios pendientes', 'pendiente'],
    ['syncing', { syncing: true }, 'Sincronización: pendiente', 'pendiente'],
    ['offline', { online: false, pendingCount: 3 }, 'Sincronización: sin conexión, 3 cambios pendientes', 'sin-conexion'],
    ['offline, empty outbox', { online: false }, 'Sincronización: sin conexión', 'sin-conexion'],
    ['authExpired', { authExpired: true, pendingCount: 1 }, 'Sincronización: pendiente, 1 cambio pendiente', 'pendiente'],
  ] as const)('%s', (_, flags, name, state) => {
    const link = renderIndicator(flags)
    expect(link).toHaveAccessibleName(name)
    expect(link).toHaveAttribute('data-state', state)
    expect(link).toHaveAttribute('href', '/perfil#sync')
  })

  it('shows the pending count next to the offline cloud', () => {
    const link = renderIndicator({ online: false, pendingCount: 3 })
    expect(link).toHaveTextContent('3')
  })
})
