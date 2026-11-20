import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/db'
import { getLastKnownUser, setLastKnownUser } from '../../data/syncMeta'
import { AccessScreen } from './AccessScreen'
import type { AuthApi, SendResult, VerifyResult } from './auth-client'
import { ensureSameUser } from './auth-client'
import { ReauthSheet } from './ReauthSheet'

const ANA = { id: 'user-ana', email: 'ana@example.com' }

function fakeApi(over: Partial<AuthApi> = {}): AuthApi & { sent: string[] } {
  const sent: string[] = []
  return {
    sent,
    async sendCode(email): Promise<SendResult> {
      sent.push(email)
      return { ok: true }
    },
    async verifyCode(): Promise<VerifyResult> {
      return { ok: true, user: ANA }
    },
    ...over,
  }
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value })
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  setOnline(true)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('AccessScreen (VA)', () => {
  it('shows "Necesitas conexión" on first open without signal and no stored user', async () => {
    setOnline(false)
    render(<AccessScreen api={fakeApi()} onSignedIn={() => {}} />)
    expect(await screen.findByText('Necesitas conexión para entrar la primera vez')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar código' })).toBeDisabled()
  })

  it('goes from email to code and stores the last known user after verifying', async () => {
    const api = fakeApi()
    const onSignedIn = vi.fn()
    render(<AccessScreen api={api} onSignedIn={onSignedIn} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
    expect(await screen.findByText(/Te enviamos un código a/)).toHaveTextContent('ana@example.com')
    expect(api.sent).toEqual(['ana@example.com'])
    fireEvent.change(screen.getByLabelText('Código de 6 dígitos'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await vi.waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(ANA))
    expect(await getLastKnownUser()).toEqual(ANA)
  })

  it('shows the wrong-code and expired-code states', async () => {
    let next: VerifyResult = { ok: false, reason: 'invalid' }
    const api = fakeApi({ verifyCode: async () => next })
    render(<AccessScreen api={api} onSignedIn={() => {}} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
    const input = await screen.findByLabelText('Código de 6 dígitos')
    fireEvent.change(input, { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Código incorrecto')
    next = { ok: false, reason: 'expired' }
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText(/El código ha caducado/)).toBeInTheDocument()
  })

  it('shows a countdown when too many codes were requested and re-enables sending when it ends', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    let limited = true
    const api = fakeApi({
      sendCode: async () => (limited ? { ok: false, reason: 'rate-limited', retryAfterSec: 90 } : { ok: true }),
    })
    render(<AccessScreen api={api} onSignedIn={() => {}} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos. Podrás pedir otro código en 1:30')
    expect(screen.getByRole('button', { name: 'Enviar código' })).toBeDisabled()

    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })
    expect(screen.getByRole('alert')).toHaveTextContent('1:00')

    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const send = screen.getByRole('button', { name: 'Enviar código' })
    expect(send).toBeEnabled()
    limited = false
    fireEvent.click(send)
    expect(await screen.findByText(/Te enviamos un código a/)).toBeInTheDocument()
  })
})

describe('ReauthSheet', () => {
  function Harness({ api }: { api: AuthApi }) {
    const [open, setOpen] = useState(true)
    const [sets, setSets] = useState(0)
    return (
      <>
        <button type="button" onClick={() => setSets((n) => n + 1)}>
          Completar serie
        </button>
        <p>Series: {sets}</p>
        {open && <ReauthSheet api={api} onDismiss={() => setOpen(false)} onSignedIn={() => setOpen(false)} />}
      </>
    )
  }

  it('locks the last known email, starts at the code step, and dismissing leaves the screen usable', async () => {
    await setLastKnownUser(ANA)
    const api = fakeApi()
    render(<Harness api={api} />)
    const sheet = await screen.findByRole('dialog', { name: 'Vuelve a entrar' })
    expect(await screen.findByText(/Te enviamos un código a/)).toHaveTextContent('ana@example.com')
    expect(api.sent).toEqual(['ana@example.com'])
    expect(screen.queryByRole('button', { name: 'Cambiar email' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }))
    expect(sheet).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Completar serie' }))
    expect(screen.getByText('Series: 1')).toBeInTheDocument()
  })
})

describe('ensureSameUser', () => {
  it('matches only the stored last known user', async () => {
    expect(await ensureSameUser(ANA.id)).toBe(false)
    await setLastKnownUser(ANA)
    expect(await ensureSameUser(ANA.id)).toBe(true)
    expect(await ensureSameUser('user-bea')).toBe(false)
  })
})
