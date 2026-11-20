import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/db'
import { getLastKnownUser, setLastKnownUser } from '../../data/syncMeta'
import { AccessScreen } from './AccessScreen'
import type { AuthApi } from './auth-client'
import { ensureSameUser } from './auth-client'
import { FORGOT_PASSWORD_TEXT } from './PasswordForm'
import { ReauthSheet } from './ReauthSheet'
import { ANA, fakeAuthApi as fakeFor } from './test-fixtures'

const fakeAuthApi = (over: Partial<AuthApi> = {}) => fakeFor(ANA, over)

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value })
}

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
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
    render(<AccessScreen api={fakeAuthApi()} onSignedIn={() => {}} />)
    expect(
      await screen.findByText('Necesitas conexión para entrar la primera vez'),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secreto-largo' } })
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled()
  })

  it('signs in with email and password and stores the last known user', async () => {
    const api = fakeAuthApi()
    const onSignedIn = vi.fn()
    render(<AccessScreen api={api} onSignedIn={onSignedIn} />)
    expect(screen.getByText(FORGOT_PASSWORD_TEXT)).toBeInTheDocument()
    fillAndSubmit(' Ana@Example.com ', 'secreto-largo')
    await vi.waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(ANA))
    expect(api.attempts).toEqual([['ana@example.com', 'secreto-largo']])
    expect(await getLastKnownUser()).toEqual(ANA)
  })

  it('shows the wrong-password state and keeps the form', async () => {
    const onSignedIn = vi.fn()
    render(
      <AccessScreen
        api={fakeAuthApi({ signIn: async () => ({ ok: false, reason: 'invalid' }) })}
        onSignedIn={onSignedIn}
      />,
    )
    fillAndSubmit('ana@example.com', 'mala-contraseña')
    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos.')
    expect(onSignedIn).not.toHaveBeenCalled()
    expect(await getLastKnownUser()).toBeNull()
  })

  it('shows a countdown after too many attempts and re-enables Entrar when it ends', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    const api = fakeAuthApi({
      signIn: async () => ({ ok: false, reason: 'rate-limited', retryAfterSec: 90 }),
    })
    render(<AccessScreen api={api} onSignedIn={() => {}} />)
    fillAndSubmit('ana@example.com', 'secreto-largo')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Demasiados intentos. Vuelve a probar en 1:30',
    )
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled()

    await act(async () => {
      vi.advanceTimersByTime(90_000)
    })
    // The countdown interval starts in an effect that can land after the first jump on slow
    // runners, so keep ticking (fake clock) until it notices the deadline has passed.
    for (let i = 0; i < 5 && screen.queryByRole('alert'); i++) {
      await act(async () => {
        vi.advanceTimersByTime(1_000)
      })
    }
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
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
        {open && (
          <ReauthSheet
            api={api}
            onDismiss={() => setOpen(false)}
            onSignedIn={() => setOpen(false)}
          />
        )}
      </>
    )
  }

  it('asks for the password with the last known email locked', async () => {
    await setLastKnownUser(ANA)
    const api = fakeAuthApi()
    render(<Harness api={api} />)
    const sheet = await screen.findByRole('dialog', { name: 'Vuelve a entrar' })
    expect(await screen.findByText(/Entra como/)).toHaveTextContent('ana@example.com')
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secreto-largo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await vi.waitFor(() => expect(sheet).not.toBeInTheDocument())
    expect(api.attempts).toEqual([['ana@example.com', 'secreto-largo']])
  })

  it('dismissing leaves the screen usable', async () => {
    await setLastKnownUser(ANA)
    render(<Harness api={fakeAuthApi()} />)
    const sheet = await screen.findByRole('dialog', { name: 'Vuelve a entrar' })
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
