import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { remainingRestMs, restEnded, scheduleRestEnd } from './notify'

describe('remainingRestMs', () => {
  const start = Date.parse('2026-11-17T10:00:00.000Z')
  const restEndsAt = new Date(start + 90_000).toISOString() // a 90 s rest

  it('derives the remaining time from restEndsAt and now', () => {
    expect(remainingRestMs(restEndsAt, start + 30_000)).toBe(60_000)
    expect(restEnded(restEndsAt, start + 30_000)).toBe(false)
  })

  it('reports 0 and ended for a 90 s rest checked after 200 s', () => {
    expect(remainingRestMs(restEndsAt, start + 200_000)).toBe(0)
    expect(restEnded(restEndsAt, start + 200_000)).toBe(true)
  })

  it('reports 0 and ended when no rest is running', () => {
    expect(remainingRestMs(null, start)).toBe(0)
    expect(restEnded(null, start)).toBe(true)
  })
})

describe('scheduleRestEnd', () => {
  const vibrations: (number | number[])[] = []
  const tones: number[] = []
  const posted: unknown[] = []

  class FakeAudioContext {
    state = 'running'
    currentTime = 0
    destination = {}
    resume() {
      return Promise.resolve()
    }
    createOscillator() {
      const osc = {
        frequency: { value: 0 },
        connect: () => undefined,
        start: () => tones.push(osc.frequency.value),
        stop: () => undefined,
      }
      return osc
    }
    createGain() {
      return {
        gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
        connect: () => undefined,
      }
    }
  }

  function setPermission(permission: NotificationPermission) {
    vi.stubGlobal('Notification', { permission, requestPermission: () => Promise.resolve(permission) })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2026-11-17T10:00:00.000Z'))
    vibrations.length = 0
    tones.length = 0
    posted.length = 0
    vi.stubGlobal('AudioContext', FakeAudioContext)
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (pattern: number | number[]) => {
        vibrations.push(pattern)
        return true
      },
    })
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: { postMessage: (msg: unknown) => posted.push(msg) } },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const restEndsAt = () => new Date(Date.now() + 90_000).toISOString()

  it('falls back to vibration and sound when notification permission is denied', () => {
    setPermission('denied')

    const rest = scheduleRestEnd({ restEndsAt: restEndsAt(), title: 'Descanso terminado', body: 'Press banca' })
    expect(rest.channel).toBe('in-page')
    expect(posted).toEqual([])

    vi.advanceTimersByTime(89_000)
    expect(vibrations).toEqual([])

    expect(() => vi.advanceTimersByTime(1_000)).not.toThrow()
    expect(vibrations).toEqual([[200, 100, 200]])
    expect(tones.length).toBeGreaterThan(0)
  })

  it('hands the notification to the service worker when permission is granted', () => {
    setPermission('granted')
    const at = restEndsAt()

    const rest = scheduleRestEnd({ restEndsAt: at, title: 'Descanso terminado', body: 'Press banca' })

    expect(rest.channel).toBe('service-worker')
    expect(posted).toEqual([
      { type: 'schedule-rest-end', at: Date.parse(at), title: 'Descanso terminado', body: 'Press banca' },
    ])
  })

  it('cancelling stops the in-page alert and the service worker notification', () => {
    setPermission('granted')

    const rest = scheduleRestEnd({ restEndsAt: restEndsAt(), title: 'Descanso terminado', body: '' })
    rest.cancel()
    vi.advanceTimersByTime(120_000)

    expect(vibrations).toEqual([])
    expect(posted.at(-1)).toEqual({ type: 'cancel-rest-end' })
  })
})
