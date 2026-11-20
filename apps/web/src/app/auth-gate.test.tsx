import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../data/db'
import { saveSettings } from '../data/repositories/settings'
import { createSyncEngine, type SessionCheck } from '../data/sync/engine'
import { createSyncStatusStore } from '../data/sync/status'
import { startSyncTriggers } from '../data/sync/triggers'
import { setLastKnownUser } from '../data/syncMeta'
import { fakeAuthApi } from '../features/auth/test-fixtures'
import { renderApp } from './test-utils'

const ANA = { id: '0190f0c0-0000-7000-8000-00000000000a', email: 'ana@example.com' }
const BEA = { id: '0190f0c0-0000-7000-8000-00000000000b', email: 'bea@example.com' }

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value })
}

/** A real engine whose network never answers; the test controls the session check. */
function offlineEngine(session: () => SessionCheck = () => ({ kind: 'ok', userId: ANA.id })) {
  const fetch = vi.fn(async () => {
    throw new TypeError('network down')
  })
  const checkSession = vi.fn(async () => session())
  const engine = createSyncEngine({
    fetch,
    checkSession,
    isOnline: () => navigator.onLine,
    status: createSyncStatusStore({ online: navigator.onLine }),
    schedule: () => () => {},
  })
  return { engine, fetch, checkSession }
}

async function signedInAndOnboarded(user = ANA) {
  await setLastKnownUser(user)
  await saveSettings({ onboardedAt: '2026-11-01T10:00:00.000Z' })
}

async function enterPassword(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Contraseña'), 'secreto-largo')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  setOnline(true)
})

afterEach(() => {
  cleanup()
})

describe('auth gate', () => {
  it('shows VA when the device has no stored user', async () => {
    const { engine } = offlineEngine()
    renderApp({ engine, authApi: fakeAuthApi(ANA), startSync: () => () => {} })
    expect(await screen.findByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Pestañas' })).not.toBeInTheDocument()
  })

  it('opens Inicio offline with a stored user, without contacting the server', async () => {
    setOnline(false)
    await signedInAndOnboarded()
    const { engine, fetch, checkSession } = offlineEngine()
    renderApp({ engine, authApi: fakeAuthApi(ANA), startSync: (e) => startSyncTriggers(e) })

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    // The onboarding settings write is still in the outbox: 1 pending change.
    const indicator = await screen.findByRole('link', { name: /sin conexión/i })
    expect(indicator).toHaveAccessibleName('Sincronización: sin conexión, 1 cambio pendiente')
    expect(fetch).not.toHaveBeenCalled()
    expect(checkSession).not.toHaveBeenCalled()
  })

  it('first open: VA, password, then onboarding (F1)', async () => {
    const user = userEvent.setup()
    const { engine } = offlineEngine()
    renderApp({ engine, authApi: fakeAuthApi(ANA), startSync: () => () => {} })

    await user.type(await screen.findByLabelText('Email'), 'ana@example.com')
    await enterPassword(user)

    expect(await screen.findByRole('heading', { name: /unidades/i })).toBeInTheDocument()
  })

  it('tapping the indicator opens the sync detail in Perfil', async () => {
    const user = userEvent.setup()
    await signedInAndOnboarded()
    const { engine } = offlineEngine()
    const { router } = renderApp({ engine, authApi: fakeAuthApi(ANA), startSync: () => () => {} })

    await user.click(await screen.findByRole('link', { name: /^Sincronización/ }))
    expect(await screen.findByRole('heading', { name: 'Perfil' })).toBeInTheDocument()
    expect(router.state.location.hash).toBe('#sync')
  })
})

describe('authExpired', () => {
  it('shows the banner, keeps Inicio usable, and the password returns status to pendiente', async () => {
    const user = userEvent.setup()
    await signedInAndOnboarded()
    let session: SessionCheck = { kind: 'none' }
    const { engine } = offlineEngine(() => session)
    renderApp({
      engine,
      authApi: fakeAuthApi(ANA),
      startSync: (e) => {
        void e.sync()
        return () => {}
      },
    })

    const banner = await screen.findByRole('region', { name: 'Sesión caducada' })
    expect(banner).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Sincronización/ })).toHaveAccessibleName(
      'Sincronización: pendiente, 1 cambio pendiente',
    )
    // Inicio still works: tabs navigate while the session is expired.
    await user.click(screen.getByRole('link', { name: 'Historial' }))
    expect(await screen.findByRole('heading', { name: 'Historial' })).toBeInTheDocument()

    session = { kind: 'ok', userId: ANA.id }
    await user.click(screen.getByRole('button', { name: 'Volver a entrar' }))
    await enterPassword(user)

    await waitFor(() => expect(engine.status.getSnapshot().status).toBe('pending'))
    expect(screen.queryByRole('region', { name: 'Sesión caducada' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Sincronización/ })).toHaveAccessibleName(
      'Sincronización: pendiente, 1 cambio pendiente',
    )
  })

  it('a sign-in to another account blocks the app and offers to sign out', async () => {
    const user = userEvent.setup()
    await signedInAndOnboarded()
    const { engine } = offlineEngine(() => ({ kind: 'none' }))
    const onSignOutRequested = vi.fn()
    renderApp({
      engine,
      authApi: fakeAuthApi(BEA),
      onSignOutRequested,
      startSync: (e) => {
        void e.sync()
        return () => {}
      },
    })

    await user.click(await screen.findByRole('button', { name: 'Volver a entrar' }))
    await enterPassword(user)

    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('otra cuenta')
    expect(engine.status.getSnapshot().status).toBe('authExpired')
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(onSignOutRequested).toHaveBeenCalledTimes(1)
  })
})

describe('update toast', () => {
  it('appears when the server reports this client outdated', async () => {
    await signedInAndOnboarded()
    const { engine } = offlineEngine()
    renderApp({ engine, authApi: fakeAuthApi(ANA), startSync: () => () => {} })
    await screen.findByRole('heading', { name: 'Inicio' })
    expect(screen.queryByRole('button', { name: 'Actualizar' })).not.toBeInTheDocument()

    act(() => engine.status.update({ updateAvailableRequired: true }))
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument()
  })
})
