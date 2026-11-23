import { useEffect, useRef } from 'react'

/**
 * Full-screen layers and sheets (workout, picker, sheets, menus) are React state, not routes.
 * `useLayer` makes them behave like native screens:
 *
 * - Back (button, edge swipe, Android back) closes the top layer instead of navigating the page
 *   underneath: opening a layer pushes a same-URL history entry, and its `popstate` closes it.
 *   Closing from the UI pops that entry again, so history stays balanced.
 * - The page behind does not scroll or bounce while any layer is open.
 */

interface Entry {
  id: string
  close: () => void
}

const stack: Entry[] = []
/** popstate events caused by our own `history.back()` after a UI close. */
let ownPops = 0
let listening = false
let seq = 0

function onPopState() {
  if (ownPops > 0) {
    ownPops--
    return
  }
  // The user went back: close the top layer whose entry was just left.
  const top = stack.pop()
  if (top) {
    syncScrollLock()
    top.close()
  }
}

function syncScrollLock() {
  document.documentElement.classList.toggle('layer-open', stack.length > 0)
}

/** Registers an open layer; `onClose` runs when the user goes back while it is on top. */
export function useLayer(onClose: () => void, open = true): void {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    if (!open || typeof window === 'undefined') return
    if (!listening) {
      window.addEventListener('popstate', onPopState)
      listening = true
    }
    const entry: Entry = { id: `layer-${++seq}`, close: () => close.current() }
    stack.push(entry)
    syncScrollLock()
    // Keep the router's own state (key, idx) so it sees the same location.
    const state = { ...(window.history.state as object | null), layer: entry.id }
    if (pendingBack !== null && currentLayer() === pendingBack) {
      // A layer that just closed is being replaced (workout → finish): reuse its entry.
      pendingBack = null
      window.history.replaceState(state, '')
    } else {
      window.history.pushState(state, '')
    }

    return () => {
      const i = stack.indexOf(entry)
      if (i === -1) return // already closed by Back
      stack.splice(i, 1)
      syncScrollLock()
      // Closed from the UI: drop our entry once this commit settles (another layer may take it).
      pendingBack = entry.id
      queueMicrotask(flushPendingBack)
    }
  }, [open])
}

/** Id of the layer entry closed from the UI whose history entry is not popped yet. */
let pendingBack: string | null = null

function currentLayer(): string | undefined {
  return (window.history.state as { layer?: string } | null)?.layer
}

function flushPendingBack() {
  const id = pendingBack
  pendingBack = null
  // Skip if something navigated on top of the entry meanwhile (a link inside the layer).
  if (id !== null && currentLayer() === id) {
    ownPops++
    window.history.back()
  }
}
