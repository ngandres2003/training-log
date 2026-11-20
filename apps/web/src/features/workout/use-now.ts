import { useEffect, useState } from 'react'

/** Current time, refreshed every second while `running` (and right away when it starts). */
export function useNow(running = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [running])
  return now
}
