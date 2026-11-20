import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShellProvider } from '../../app/shell'
import { InviteSection } from './InviteSection'
import type { InviteSummary, InvitesApi } from './invites-api'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value })
}

const PENDING: InviteSummary = {
  id: 'inv-1',
  email: 'bea@example.com',
  createdAt: '2026-11-20T10:00:00.000Z',
  expiresAt: '2026-11-27T10:00:00.000Z',
  usedAt: null,
  status: 'pending',
}

function fakeInvitesApi(isAdmin: boolean): InvitesApi & { created: string[]; revoked: string[] } {
  let list: InviteSummary[] = []
  const created: string[] = []
  const revoked: string[] = []
  return {
    created,
    revoked,
    isAdmin: async () => isAdmin,
    async create(email) {
      created.push(email)
      list = [{ ...PENDING, email }]
      return { ok: true, invite: list[0]!, url: `https://app.example/invitacion/tok-${email}` }
    },
    list: async () => list,
    async revoke(id) {
      revoked.push(id)
      list = list.map((i) => (i.id === id ? { ...i, status: 'revoked' } : i))
      return true
    },
  }
}

function renderSection(api: InvitesApi) {
  return render(
    <ShellProvider deps={{ invitesApi: api, startSync: () => () => {} }}>
      <InviteSection />
    </ShellProvider>,
  )
}

beforeEach(() => setOnline(true))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Perfil · Invitar', () => {
  it('is hidden for an account that is not an admin', async () => {
    const api = fakeInvitesApi(false)
    const isAdmin = vi.spyOn(api, 'isAdmin')
    renderSection(api)
    await vi.waitFor(() => expect(isAdmin).toHaveBeenCalled())
    expect(screen.queryByRole('heading', { name: 'Invitar' })).not.toBeInTheDocument()
  })

  it('lets an admin generate a link, copy it, share it and revoke the invite', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const share = vi.fn(async () => {})
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    const api = fakeInvitesApi(true)
    renderSection(api)

    await user.type(await screen.findByLabelText('Email de la persona'), 'Bea@Example.com')
    await user.click(screen.getByRole('button', { name: 'Generar enlace' }))
    expect(api.created).toEqual(['bea@example.com'])
    const url = 'https://app.example/invitacion/tok-bea@example.com'
    expect(await screen.findByLabelText('Enlace de invitación')).toHaveTextContent(url)

    await user.click(screen.getByRole('button', { name: 'Copiar enlace' }))
    expect(writeText).toHaveBeenCalledWith(url)
    expect(await screen.findByText('Enlace copiado.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Compartir' }))
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url }))

    const list = await screen.findByRole('list', { name: 'Invitaciones' })
    expect(within(list).getByText(/Pendiente/)).toBeInTheDocument()
    await user.click(within(list).getByRole('button', { name: 'Revocar invitación de bea@example.com' }))
    expect(api.revoked).toEqual(['inv-1'])
    expect(await within(list).findByText(/Revocada/)).toBeInTheDocument()

    Reflect.deleteProperty(navigator, 'share')
  })

  it('falls back to copying when the browser cannot share', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    renderSection(fakeInvitesApi(true))
    await user.type(await screen.findByLabelText('Email de la persona'), 'bea@example.com')
    await user.click(screen.getByRole('button', { name: 'Generar enlace' }))
    await user.click(await screen.findByRole('button', { name: 'Compartir' }))
    expect(writeText).toHaveBeenCalled()
  })

  it('is disabled offline once known to be an admin', async () => {
    const api = fakeInvitesApi(true)
    const { rerender } = renderSection(api)
    expect(await screen.findByLabelText('Email de la persona')).toBeEnabled()
    setOnline(false)
    window.dispatchEvent(new Event('offline'))
    rerender(
      <ShellProvider deps={{ invitesApi: api, startSync: () => () => {} }}>
        <InviteSection />
      </ShellProvider>,
    )
    expect(await screen.findByText('Sin conexión. Conéctate para invitar.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email de la persona')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Generar enlace' })).toBeDisabled()
  })
})
