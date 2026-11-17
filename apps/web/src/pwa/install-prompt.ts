/**
 * Install guidance for V0 step 3. Chromium fires `beforeinstallprompt`, which we capture
 * to show our own button. iOS has no prompt, so it gets "Añadir a pantalla de inicio"
 * instructions; installing there is also what enables web notifications (iOS 16.4+).
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallGuidance = 'installed' | 'prompt' | 'ios-instructions' | 'unavailable'

export const IOS_INSTALL_INSTRUCTIONS = [
  'Abre esta página en Safari.',
  'Toca el botón Compartir.',
  'Elige «Añadir a pantalla de inicio» y confirma con «Añadir».',
] as const

export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true
  // iPadOS Safari reports a Mac user agent by default; real Macs have no touch points.
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1
}

export function installGuidance(env: {
  userAgent: string
  maxTouchPoints: number
  standalone: boolean
  hasPrompt: boolean
}): InstallGuidance {
  if (env.standalone) return 'installed'
  if (env.hasPrompt) return 'prompt'
  if (isIos(env.userAgent, env.maxTouchPoints)) return 'ios-instructions'
  return 'unavailable'
}

export function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

/** Call once at startup, before the browser fires the event. */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

/** Subscribe for useSyncExternalStore together with currentInstallGuidance. */
export function subscribeInstallGuidance(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function currentInstallGuidance(): InstallGuidance {
  return installGuidance({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone: isStandalone(),
    hasPrompt: deferredPrompt !== null,
  })
}

/** Shows the native install prompt; the captured event can be used only once. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferredPrompt
  if (!event) return 'unavailable'
  deferredPrompt = null
  notify()
  await event.prompt()
  const { outcome } = await event.userChoice
  return outcome
}
