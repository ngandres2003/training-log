import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from '../../app/test-utils'
import { db } from '../../data/db'
import { saveSettings } from '../../data/repositories/settings'
import { createSyncEngine } from '../../data/sync/engine'
import { createSyncStatusStore } from '../../data/sync/status'
import { getLastKnownUser, setLastKnownUser } from '../../data/syncMeta'
import type { AuthApi, InviteCheck, RedeemResult } from './auth-client'
import { fakeAuthApi } from './test-fixtures'

const ANA = { id: '0190f0c0-0000-7000-8000-00000000000a', email: 'ana@example.com' }
const TOKEN = 'tok_abcdefghijklmnopqrstuvwxyz0123456789ABCDE'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value })
}

function engine() {
  return createSyncEngine({
    fetch: vi.fn(async () => {
      throw new TypeError('network down')
    }),
    checkSession: async () => ({ kind: 'network' }),
    isOnline: () => true,
    status: createSyncStatusStore({ online: true }),
    schedule: () => () => {},
  })
}

function inviteApi(check: InviteCheck, redeem: RedeemResult = { ok: true, user: ANA }) {
  const redeemed: [string, string][] = []
  const api: AuthApi = fakeAuthApi(ANA, {
    checkInvite: async () => check,
    redeemInvite: async (token, password) => {
      redeemed.push([token, password])
      return redeem
    },
  })
  return { api, redeemed }
}

function open(api: AuthApi) {
  return renderApp({ engine: engine(), authApi: api, startSync: () => () => {} }, `/invitacion/${TOKEN}`)
}

async function setPassword(user: ReturnType<typeof userEvent.setup>, password: string, confirm = password) {
  await user.type(await screen.findByLabelText('Contraseña'), password)
  await user.type(screen.getByLabelText('Repite la contraseña'), confirm)
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  setOnline(true)
})

afterEach(cleanup)

describe('invitation page', () => {
  it('on a fresh device sets the password, signs in and continues to onboarding', async () => {
    const user = userEvent.setup()
    const { api, redeemed } = inviteApi({ ok: true, email: ANA.email, status: 'pending', hasAccount: false })
    open(api)

    expect(await screen.findByText(/Crea tu contraseña para/)).toHaveTextContent(ANA.email)
    await setPassword(user, 'secreto-largo')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta y entrar' }))

    expect(await screen.findByRole('heading', { name: /unidades/i })).toBeInTheDocument()
    expect(redeemed).toEqual([[TOKEN, 'secreto-largo']])
    expect(await getLastKnownUser()).toEqual(ANA)
  })

  it('checks length and confirmation before calling the server', async () => {
    const user = userEvent.setup()
    const { api, redeemed } = inviteApi({ ok: true, email: ANA.email, status: 'pending', hasAccount: false })
    open(api)

    await setPassword(user, 'corta', 'corta')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta y entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('al menos 8 caracteres')

    await user.clear(screen.getByLabelText('Contraseña'))
    await user.clear(screen.getByLabelText('Repite la contraseña'))
    await setPassword(user, 'secreto-largo', 'secreto-largx')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta y entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Las contraseñas no coinciden.')
    expect(redeemed).toEqual([])
  })

  it('for an existing account offers a new password and keeps the data', async () => {
    const user = userEvent.setup()
    await setLastKnownUser(ANA)
    await saveSettings({ onboardedAt: '2026-11-01T10:00:00.000Z' })
    const { api } = inviteApi({ ok: true, email: ANA.email, status: 'pending', hasAccount: true })
    open(api)

    expect(await screen.findByText(/Tus datos se mantienen/)).toBeInTheDocument()
    await setPassword(user, 'contraseña-nueva')
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña y entrar' }))
    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument()
  })

  it.each([
    [{ ok: true, email: ANA.email, status: 'expired', hasAccount: false } as const, 'ha caducado'],
    [{ ok: true, email: ANA.email, status: 'used', hasAccount: true } as const, 'ya se ha usado'],
    [{ ok: true, email: ANA.email, status: 'revoked', hasAccount: false } as const, 'se ha generado uno más nuevo'],
    [{ ok: false, reason: 'invalid' } as const, 'no es válido'],
  ])('explains a link that cannot be used (%#)', async (check, text) => {
    open(inviteApi(check).api)
    expect(await screen.findByRole('alert')).toHaveTextContent(text)
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument()
  })

  it('shows a server-side failure when redeeming', async () => {
    const user = userEvent.setup()
    const { api } = inviteApi(
      { ok: true, email: ANA.email, status: 'pending', hasAccount: false },
      { ok: false, reason: 'used' },
    )
    open(api)
    await setPassword(user, 'secreto-largo')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta y entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('ya se ha usado')
  })

  it("does not use another account's link on a device that holds an account", async () => {
    await setLastKnownUser({ id: 'user-bea', email: 'bea@example.com' })
    const { api } = inviteApi({ ok: true, email: ANA.email, status: 'pending', hasAccount: false })
    open(api)
    expect(await screen.findByRole('alert')).toHaveTextContent('cierra antes la sesión en Perfil')
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument()
  })
})
