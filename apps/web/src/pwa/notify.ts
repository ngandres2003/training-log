/**
 * Rest-end signalling (spec V5/V6, KTD9, KTD13).
 *
 * Remaining rest is always derived from `restEndsAt` and the current time, never from
 * tick counts: background tabs freeze intervals and iOS does not guarantee background
 * timers, so the UI recomputes on return.
 *
 * At rest end the page vibrates and plays a short tone. When notification permission is
 * granted and a service worker controls the page, the worker also shows a notification
 * at `restEndsAt` if the page is hidden at that moment and the worker is still alive.
 */

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

export type RestEndChannel = 'service-worker' | 'in-page'

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
  const channel: RestEndChannel =
    notificationPermission() === 'granted' &&
    postToWorker({ type: 'schedule-rest-end', at, title: input.title, body: input.body })
      ? 'service-worker'
      : 'in-page'

  const timer = setTimeout(() => {
    // When hidden with a worker notification pending, the worker alerts instead.
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
    if (channel === 'in-page' || !hidden) playRestEndAlert()
  }, remainingRestMs(input.restEndsAt, now))

  return {
    channel,
    cancel: () => {
      clearTimeout(timer)
      if (channel === 'service-worker') postToWorker({ type: 'cancel-rest-end' })
    },
  }
}
