import { Ellipsis } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

export interface MenuItem {
  label: string
  onSelect: () => void
  destructive?: boolean
}

/** "⋯" button opening a list of actions (V1 card and folder menus). Escape or outside tap closes it. */
export function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
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
        className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg text-polvo"
      >
        <Ellipsis aria-hidden="true" className="size-6" />
      </button>
      {open && (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            className="absolute right-0 z-50 mt-1 flex min-w-56 flex-col rounded-xl border border-borde-fuerte bg-asfalto py-1 shadow-lg"
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
