/**
 * Screen Wake Lock for V5. The browser releases the lock whenever the page is hidden,
 * so it is re-acquired when the page becomes visible again.
 *
 * Usage (while V5 is mounted): `useEffect(() => keepScreenAwake(), [])`.
 */
export function keepScreenAwake(): () => void {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return () => undefined

  let sentinel: WakeLockSentinel | null = null
  let active = true

  const acquire = async () => {
    if (!active || document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return
    try {
      const next = await navigator.wakeLock.request('screen')
      if (active) sentinel = next
      else void next.release()
    } catch {
      // Denied (low battery, not visible, unsupported context): the workout still works.
    }
  }

  const onVisibilityChange = () => void acquire()

  document.addEventListener('visibilitychange', onVisibilityChange)
  void acquire()

  return () => {
    active = false
    document.removeEventListener('visibilitychange', onVisibilityChange)
    if (sentinel && !sentinel.released) void sentinel.release().catch(() => undefined)
    sentinel = null
  }
}
