import 'fake-indexeddb/auto'
import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveSettings } from '../data/repositories/settings'
import { resetDb } from '../data/testUtils'
import { applyTheme, resolveTheme, ThemeSync } from './theme'

function mockSystemDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query.includes('dark'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

describe('theme', () => {
  beforeEach(async () => {
    await resetDb()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete document.documentElement.dataset.theme
  })

  it('"system" follows the OS preference', () => {
    mockSystemDark(true)
    expect(resolveTheme('system')).toBe('dark')
    mockSystemDark(false)
    expect(resolveTheme('system')).toBe('light')
  })

  it('applyTheme sets data-theme and remembers the choice', () => {
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('tl-theme')).toBe('dark')
  })

  it('new settings default to light, and changing the setting re-themes the page', async () => {
    const s = await saveSettings({})
    expect(s.theme).toBe('light')
    render(<ThemeSync />)
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'))

    await saveSettings({ theme: 'dark' })
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'))
  })
})
