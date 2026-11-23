/**
 * Rest-end signalling (spec V5/V6, KTD9, KTD13).
 *
 * Remaining rest is always derived from `restEndsAt` and the current time, never from
 * tick counts: background tabs freeze intervals and iOS does not guarantee background
 * timers, so the UI recomputes on return.
 *
 * At rest end the page vibrates and plays a short tone. When notification permission is
 * granted and this device has a push subscription (push.ts), the server sends a Web Push at
 * `restEndsAt` unless the visible page cancels it first. Without push, a controlling service
 * worker shows the notification from a timer, which only works while the browser keeps it alive.
 */
import { cancelServerRest, pushActive, scheduleServerRest } from './push'

/** Milliseconds of rest left; 0 when the rest has ended or none is running. */
export function remainingRestMs(restEndsAt: string | null, now: number): number {
  if (restEndsAt === null) return 0
  return Math.max(0, Date.parse(restEndsAt) - now)
}

export function restEnded(restEndsAt: string | null, now: number): boolean {
  return remainingRestMs(restEndsAt, now) === 0
}

/** Messages the page sends to the service worker (see sw.ts). */
export type RestEndMessage =
  | { type: 'schedule-rest-end'; at: number; title: string; body: string }
  | { type: 'cancel-rest-end' }

export type RestEndChannel = 'push' | 'service-worker' | 'in-page'

export interface ScheduledRestEnd {
  /** Where the hidden-page alert comes from; the visible page always vibrates and beeps. */
  channel: RestEndChannel
  /** Call when the rest is skipped, changed or the workout ends. */
  cancel: () => void
}

const VIBRATION_PATTERN = [200, 100, 200]

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

/**
 * Asks for notification permission (V0 step 3). On iOS this only works inside the
 * installed PWA (iOS 16.4+); elsewhere it returns 'unsupported'.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

function postToWorker(message: RestEndMessage): boolean {
  const controller = typeof navigator !== 'undefined' ? navigator.serviceWorker?.controller : null
  if (!controller) return false
  controller.postMessage(message)
  return true
}

let audioContext: AudioContext | null = null

/**
 * Creates or resumes the shared AudioContext. Scheduling happens from a tap (checking a
 * set), which lets iOS unlock audio for the later tone.
 */
function primeAudio(): AudioContext | null {
  try {
    if (typeof AudioContext === 'undefined') return null
    audioContext ??= new AudioContext()
    if (audioContext.state === 'suspended') void audioContext.resume().catch(() => undefined)
    return audioContext
  } catch {
    return null
  }
}

function playTone(): void {
  const ctx = primeAudio()
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    // Sound is best effort; the on-screen state is the source of truth.
  }
}

/** Vibration plus a short tone. Never throws. */
export function playRestEndAlert(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(VIBRATION_PATTERN)
    }
  } catch {
    // Vibration is unavailable on iOS and in some browsers.
  }
  playTone()
}

/**
 * Schedules the rest-end alert for `restEndsAt`. A new schedule should replace the
 * previous one: cancel the old handle first (the worker also keeps only the latest).
 */
export function scheduleRestEnd(
  input: { restEndsAt: string; title: string; body: string },
  now: number = Date.now(),
): ScheduledRestEnd {
  primeAudio()

  const at = Date.parse(input.restEndsAt)
  const granted = notificationPermission() === 'granted'
  const scheduleWorker = () => postToWorker({ type: 'schedule-rest-end', at, title: input.title, body: input.body })

  let channel: RestEndChannel = 'in-page'
  let serverId: string | null = null
  if (granted && pushActive()) {
    // The server push reaches a locked phone; if it cannot be scheduled, fall back to the worker.
    channel = 'push'
    const id = newRestId()
    serverId = id
    void scheduleServerRest({ id, at, title: input.title, body: input.body }).then((ok) => {
      if (!ok && serverId === id) {
        serverId = null
        scheduleWorker()
      }
    })
  } else if (granted && scheduleWorker()) {
    channel = 'service-worker'
  }

  const timer = setTimeout(() => {
    // When hidden with a notification pending, the worker or the push alerts instead.
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
    if (channel === 'in-page' || !hidden) {
      playRestEndAlert()
      // Visible: the server holds its push for a short grace, so cancelling now prevents a duplicate.
      if (serverId) cancelServerRest(serverId)
      serverId = null
    }
  }, remainingRestMs(input.restEndsAt, now))

  return {
    channel,
    cancel: () => {
      clearTimeout(timer)
      if (serverId) cancelServerRest(serverId)
      serverId = null
      postToWorker({ type: 'cancel-rest-end' })
    },
  }
}

function newRestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
