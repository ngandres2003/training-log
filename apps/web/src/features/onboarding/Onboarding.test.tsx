import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from '../../app/test-utils'
import { db } from '../../data/db'
import { getSettings } from '../../data/repositories/settings'
import { createSyncEngine } from '../../data/sync/engine'
import { createSyncStatusStore } from '../../data/sync/status'
import { setLastKnownUser } from '../../data/syncMeta'
import type { AuthApi } from '../auth/auth-client'

const ANA = { id: '0190f0c0-0000-7000-8000-00000000000a', email: 'ana@example.com' }

const noAuth: AuthApi = {
  sendCode: async () => ({ ok: false, reason: 'offline' }),
  verifyCode: async () => ({ ok: false, reason: 'offline' }),
}

function deps() {
  const engine = createSyncEngine({
    fetch: vi.fn(async () => {
      throw new TypeError('network down')
    }),
    checkSession: async () => ({ kind: 'network' }),
    isOnline: () => false,
    status: createSyncStatusStore({ online: false }),
    schedule: () => () => {},
  })
  return { engine, authApi: noAuth, startSync: () => () => {} }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  await setLastKnownUser(ANA)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Onboarding (V0)', () => {
  it('saves unit, name, weekly goal and default rest, and does not show again', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: async () => 'granted' })
    renderApp(deps())

    // Step 1: units and name (name starts empty: there is no profile to prefill from).
    expect(await screen.findByRole('heading', { name: 'Unidades y nombre' })).toBeInTheDocument()
    const name = screen.getByLabelText('Nombre')
    expect(name).toHaveValue('')
    await user.click(screen.getByRole('radio', { name: 'lb' }))
    await user.type(name, 'Ana')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))

    // Step 2: weekly goal only (rest is set per exercise, there is no global default).
    expect(await screen.findByRole('heading', { name: 'Tu objetivo' })).toBeInTheDocument()
    const goal = screen.getByRole('radiogroup', { name: 'Días por semana' })
    expect(within(goal).getAllByRole('radio')).toHaveLength(7)
    await user.click(within(goal).getByRole('radio', { name: '5' }))
    expect(screen.queryByRole('radiogroup', { name: /descanso/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))

    // Step 3: install and notifications, then finish.
    expect(await screen.findByRole('heading', { name: 'Instala la app' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Activar notificaciones' }))
    expect(await screen.findByText('Notificaciones activadas.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Empezar' }))

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    const saved = await getSettings()
    expect(saved).toMatchObject({ unit: 'lb', displayName: 'Ana', weeklyGoal: 5 })
    expect(saved).not.toHaveProperty('defaultRestSec')
    expect(saved?.onboardedAt).not.toBeNull()

    cleanup()
    renderApp(deps())
    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Unidades y nombre' })).not.toBeInTheDocument()
  })

  it('goes back to the previous step keeping the choices', async () => {
    const user = userEvent.setup()
    renderApp(deps())
    await user.click(await screen.findByRole('radio', { name: 'lb' }))
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await user.click(await screen.findByRole('button', { name: 'Atrás' }))
    expect(await screen.findByRole('radio', { name: 'lb' })).toBeChecked()
  })
})
