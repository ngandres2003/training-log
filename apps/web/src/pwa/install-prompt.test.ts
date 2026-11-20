import { describe, expect, it } from 'vitest'
import { installGuidance } from './install-prompt'

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP_MODE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'

describe('installGuidance', () => {
  it('shows the Añadir a pantalla de inicio instructions on iPhone Safari', () => {
    expect(
      installGuidance({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5, standalone: false, hasPrompt: false }),
    ).toBe('ios-instructions')
  })

  it('treats an iPad reporting a Mac user agent as iOS', () => {
    expect(
      installGuidance({ userAgent: IPAD_DESKTOP_MODE, maxTouchPoints: 5, standalone: false, hasPrompt: false }),
    ).toBe('ios-instructions')
  })

  it('reports installed when running standalone from the home screen', () => {
    expect(
      installGuidance({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5, standalone: true, hasPrompt: false }),
    ).toBe('installed')
  })

  it('offers the native prompt on Android once beforeinstallprompt was captured', () => {
    expect(
      installGuidance({ userAgent: ANDROID_CHROME, maxTouchPoints: 5, standalone: false, hasPrompt: true }),
    ).toBe('prompt')
    expect(
      installGuidance({ userAgent: ANDROID_CHROME, maxTouchPoints: 5, standalone: false, hasPrompt: false }),
    ).toBe('unavailable')
  })
})
