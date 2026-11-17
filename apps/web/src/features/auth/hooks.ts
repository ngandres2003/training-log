import { useCallback, useEffect, useState } from 'react'

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

/** Seconds left until a deadline, ticking once per second. `start(sec)` sets a new deadline. */
export function useCountdown(initialSeconds = 0): [remaining: number, start: (seconds: number) => void] {
  const [deadline, setDeadline] = useState(() => Date.now() + initialSeconds * 1000)
  const [now, setNow] = useState(() => Date.now())
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000))

  const running = remaining > 0

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running])

  const start = useCallback((seconds: number) => {
    const t = Date.now()
    setNow(t)
    setDeadline(t + seconds * 1000)
  }, [])

  return [remaining, start]
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
