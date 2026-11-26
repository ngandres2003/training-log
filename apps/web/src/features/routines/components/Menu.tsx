import { Ellipsis } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface MenuItem {
  label: string
  onSelect: () => void
  destructive?: boolean
}

const GAP = 4
const MARGIN = 8

/**
 * "⋯" button opening a list of actions (V1 card and folder menus). Escape, outside tap, scroll or
 * resize closes it. The list is portaled to <body> with fixed positioning so a card's
 * `overflow-hidden` cannot clip it; it opens upward when there is no room below.
 */
export function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open) return
    const button = buttonRef.current
    const menu = menuRef.current
    if (!button || !menu) return
    const b = button.getBoundingClientRect()
    const h = menu.offsetHeight
    menu.style.right = `${Math.max(MARGIN, window.innerWidth - b.right)}px`
    const fitsBelow = b.bottom + GAP + h <= window.innerHeight - MARGIN
    if (fitsBelow || b.top - GAP - h < MARGIN) menu.style.top = `${b.bottom + GAP}px`
    else menu.style.bottom = `${window.innerHeight - b.top + GAP}px`
    menu.style.visibility = 'visible'
    menu.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg text-polvo"
      >
        <Ellipsis aria-hidden="true" className="size-6" />
      </button>
      {open &&
        createPortal(
          <>
            <div aria-hidden="true" className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              className="invisible fixed z-50 flex max-w-[calc(100vw-1rem)] min-w-56 flex-col rounded-xl border border-borde-fuerte bg-asfalto py-1 shadow-lg"
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    item.onSelect()
                  }}
                  className={`min-h-12 px-4 text-left ${item.destructive ? 'text-[#e05d5d]' : 'text-arena'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </div>
  )
}
