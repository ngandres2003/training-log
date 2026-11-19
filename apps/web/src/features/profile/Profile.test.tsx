import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { ShellProvider } from '../../app/shell'
import { db } from '../../data/db'
import { createFolder } from '../../data/repositories/folders'
import { createSyncEngine } from '../../data/sync/engine'
import { createSyncStatusStore } from '../../data/sync/status'
import { resetDb } from '../../data/testUtils'
import { Profile } from './Profile'
import { signOut } from './sign-out'

function offlineEngine() {
  return createSyncEngine({
    fetch: vi.fn(async () => {
      throw new TypeError('network down')
    }),
    checkSession: async () => ({ kind: 'network' }),
    isOnline: () => false,
    status: createSyncStatusStore({ online: false }),
    schedule: () => () => {},
  })
}

function renderProfile(props: Parameters<typeof Profile>[0]) {
  const router = createMemoryRouter([{ path: '/perfil', element: <Profile {...props} /> }], {
    initialEntries: ['/perfil'],
  })
  return render(
    <ShellProvider deps={{ engine: offlineEngine(), startSync: () => () => {} }}>
      <RouterProvider router={router} />
    </ShellProvider>,
  )
}

beforeEach(resetDb)
afterEach(cleanup)

describe('Profile (V12) sign-out', () => {
  it('offline with 3 pending changes offers only "Salir y perder 3 cambios", behind a confirmation', async () => {
    const user = userEvent.setup()
    for (const name of ['A', 'B', 'C']) await createFolder({ name, order: 0 })
    const onSignOut = vi.fn(async () => {})
    renderProfile({ onSignOut })

    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByText('Tienes 3 cambios sin subir.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sincronizar y salir' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Salir y perder 3 cambios' }))
    expect(onSignOut).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Sí, perder 3 cambios y salir' }))
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('with nothing pending signs out straight away', async () => {
    const user = userEvent.setup()
    const onSignOut = vi.fn(async () => {})
    renderProfile({ onSignOut })
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('"Borrar todos mis datos" is disabled while offline', async () => {
    renderProfile({})
    expect(await screen.findByRole('button', { name: 'Borrar todos mis datos' })).toBeDisabled()
  })
})

describe('signOut', () => {
  it('deletes the local database and reloads to / even when the server cannot be reached', async () => {
    await createFolder({ name: 'A', order: 0 })
    const reloadTo = vi.fn()
    await signOut({ endSession: async () => Promise.reject(new TypeError('offline')), reloadTo })
    expect(reloadTo).toHaveBeenCalledWith('/')
    await db.open()
    expect(await db.folders.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
    expect(await db.syncMeta.get('lastKnownUser')).toBeUndefined()
  })
})
