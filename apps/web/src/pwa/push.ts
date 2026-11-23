/**
 * Web Push for rest end (API: /api/push, see apps/api/src/push/router.ts).
 *
 * A browser timer cannot be trusted while the app is in the background (iOS does not run the
 * service worker at all), so the server sends the push at rest end + a short grace. When the
 * page is visible at rest end it alerts by itself and cancels the push in time.
 */

export type PushState = 'unsupported' | 'denied' | 'default' | 'unconfigured' | 'off' | 'on'

let subscribed = false
const listeners = new Set<() => void>()
let state: PushState = initialState()

function initialState(): PushState {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission === 'default') return 'default'
  return 'off'
}

function setState(next: PushState) {
  state = next
  subscribed = next === 'on'
  listeners.forEach((l) => l())
}

export function subscribePushState(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function pushState(): PushState {
  return state
}

/** Whether rest alerts go through the server right now. */
export function pushActive(): boolean {
  return subscribed
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  )
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const current = sub.options.applicationServerKey
  if (!current) return false
  const a = new Uint8Array(current)
  return a.length === key.length && a.every((b, i) => b === key[i])
}

/**
 * Makes sure this device has a push subscription registered with the server. Safe to call
 * often (app start, after granting permission); never asks for permission itself.
 */
export async function ensurePushSubscription(options: { optIn?: boolean } = {}): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission !== 'granted') {
    setState(Notification.permission === 'denied' ? 'denied' : 'default')
    return state
  }
  if (options.optIn) setOptedOut(false)
  else if (optedOut()) {
    setState('off')
    return state
  }
  try {
    const keyRes = await fetch('/api/push/key', { credentials: 'same-origin' })
    if (keyRes.status === 503) {
      setState('unconfigured')
      return state
    }
    if (!keyRes.ok) return state
    const { publicKey } = (await keyRes.json()) as { publicKey: string }
    const key = base64UrlToBytes(publicKey)

    // In dev no worker is registered, and `ready` would never resolve.
    const registration =
      (await navigator.serviceWorker.getRegistration()) ??
      (import.meta.env.PROD ? await navigator.serviceWorker.ready : undefined)
    if (!registration) return state
    let sub = await registration.pushManager.getSubscription()
    if (sub && !sameKey(sub, key)) {
      await sub.unsubscribe()
      sub = null
    }
    sub ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })

    const res = await fetch('/api/push/subscriptions', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    })
    setState(res.ok ? 'on' : 'off')
  } catch {
    setState('off')
  }
  return state
}

/** Turns push off on this device (the in-page and service-worker alerts keep working). */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return
  setOptedOut(true)
  try {
    const registration = await navigator.serviceWorker.ready
    const sub = await registration.pushManager.getSubscription()
    if (sub) {
      await fetch('/api/push/subscriptions', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => undefined)
      await sub.unsubscribe()
    }
  } finally {
    setState(initialState())
  }
}

const OPT_OUT_KEY = 'push-opt-out'

/** "Desactivar en este dispositivo" sticks across restarts until the user turns it back on. */
function optedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === '1'
  } catch {
    return false
  }
}

function setOptedOut(value: boolean): void {
  try {
    if (value) localStorage.setItem(OPT_OUT_KEY, '1')
    else localStorage.removeItem(OPT_OUT_KEY)
  } catch {
    // Storage unavailable: the choice lasts for this page load only.
  }
}

/** Asks the server to push at `at` (epoch ms). Resolves false when it could not be scheduled. */
export async function scheduleServerRest(input: { id: string; at: number; title: string; body: string }): Promise<boolean> {
  try {
    const res = await fetch('/api/push/rest', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Cancels the server push `id`. `keepalive` lets it finish while the page goes away. */
export function cancelServerRest(id: string): void {
  void fetch(`/api/push/rest/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    keepalive: true,
  }).catch(() => undefined)
}
