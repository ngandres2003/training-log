import type { Theme } from '@training-log/domain'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { getSettings } from '../data/repositories/settings'

/** localStorage key read by the pre-paint script in index.html. */
const STORAGE_KEY = 'tl-theme'
const DEFAULT_THEME: Theme = 'light'
const BAR_COLOR = { light: '#f7f4ec', dark: '#0e0e0c' } as const

function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return theme
}

/** Sets `data-theme` on <html>, the browser bar colour, and remembers the choice for the next load. */
export function applyTheme(theme: Theme): void {
  const resolved = resolveTheme(theme)
  document.documentElement.dataset.theme = resolved
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[resolved])
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage blocked: the theme still applies for this page.
  }
}

/** Keeps the page theme in sync with the user's setting (and with the OS when it is "Sistema"). */
export function ThemeSync(): null {
  const theme = useLiveQuery(async () => (await getSettings())?.theme)
  useEffect(() => {
    if (theme === undefined) return
    applyTheme(theme ?? DEFAULT_THEME)
    if (theme !== 'system' || typeof matchMedia !== 'function') return
    const query = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [theme])
  return null
}
