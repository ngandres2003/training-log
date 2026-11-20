import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestPersistentStorage } from './storage'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestPersistentStorage', () => {
  it('returns the browser answer when persist() is available', async () => {
    vi.stubGlobal('navigator', { storage: { persist: () => Promise.resolve(true) } })
    expect(await requestPersistentStorage()).toBe(true)
  })

  it('returns false when the browser has no storage manager', async () => {
    vi.stubGlobal('navigator', {})
    expect(await requestPersistentStorage()).toBe(false)
  })
})
