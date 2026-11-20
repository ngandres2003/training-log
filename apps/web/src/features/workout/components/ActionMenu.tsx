import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export interface ActionItem {
  label: string
  onSelect: () => void
  destructive?: boolean
}

/**
 * Button opening a list of actions (exercise ⋯ menu, set-row menu). It is the visible
 * alternative to gestures (KTD16): deleting a set goes here, since the carousel owns swipe.
 */
export function ActionMenu({
  label,
  items,
  children,
  className = '',
}: {
  label: string
  items: ActionItem[]
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
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
        className={`inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg ${className}`}
      >
        {children}
      </button>
      {open && (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            className="absolute left-0 z-50 mt-1 flex min-w-56 flex-col rounded-xl border border-borde-fuerte bg-asfalto py-1 shadow-lg"
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
        </>
      )}
    </div>
  )
}
