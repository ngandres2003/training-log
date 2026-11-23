import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.hoisted(() => ({
  active: false,
  scheduleOk: true,
  scheduled: [] as { id: string; at: number; title: string; body: string }[],
  cancelled: [] as string[],
}))

vi.mock('./push', () => ({
  pushActive: () => push.active,
  scheduleServerRest: async (input: (typeof push.scheduled)[number]) => {
    push.scheduled.push(input)
    return push.scheduleOk
  },
  cancelServerRest: (id: string) => push.cancelled.push(id),
}))
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

  describe('with a push subscription', () => {
    beforeEach(() => {
      push.active = true
      push.scheduleOk = true
      push.scheduled.length = 0
      push.cancelled.length = 0
      setPermission('granted')
    })
    afterEach(() => {
      push.active = false
      vi.unstubAllGlobals()
    })

    it('asks the server to push at rest end instead of the worker timer', async () => {
      const at = restEndsAt()
      const rest = scheduleRestEnd({ restEndsAt: at, title: 'Descanso terminado', body: 'Press banca' })
      await vi.advanceTimersByTimeAsync(0)

      expect(rest.channel).toBe('push')
      expect(push.scheduled).toEqual([
        { id: expect.any(String), at: Date.parse(at), title: 'Descanso terminado', body: 'Press banca' },
      ])
      expect(posted).toEqual([])
    })

    it('a visible page alerts itself and cancels the server push', async () => {
      scheduleRestEnd({ restEndsAt: restEndsAt(), title: 't', body: '' })
      await vi.advanceTimersByTimeAsync(90_000)

      expect(vibrations).toEqual([[200, 100, 200]])
      expect(push.cancelled).toEqual([push.scheduled[0]!.id])
    })

    it('falls back to the worker timer when the server cannot schedule', async () => {
      push.scheduleOk = false
      scheduleRestEnd({ restEndsAt: restEndsAt(), title: 't', body: '' })
      await vi.advanceTimersByTimeAsync(0)

      expect(posted).toEqual([expect.objectContaining({ type: 'schedule-rest-end' })])
    })

    it('cancelling cancels the server push', async () => {
      const rest = scheduleRestEnd({ restEndsAt: restEndsAt(), title: 't', body: '' })
      await vi.advanceTimersByTimeAsync(0)
      rest.cancel()

      expect(push.cancelled).toEqual([push.scheduled[0]!.id])
    })
  })
})
