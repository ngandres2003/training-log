import { ChevronRight, Ellipsis } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { MORE_MODULES } from './modules'
import { useLayer } from '../../ui/layer'

/**
 * "Más" tab: a dropdown that opens above the tab bar with one entry per module (./modules) and
 * goes straight to the chosen one. The tab stays lit while inside any of those modules.
 */
export function MoreMenu({ tabClassName }: { tabClassName: (active: boolean) => string }) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useLayer(() => setOpen(false), open)
  const inside = MORE_MODULES.some((m) => pathname === m.to || pathname.startsWith(`${m.to}/`))

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
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`w-full ${tabClassName(inside || open)}`}
      >
        <Ellipsis aria-hidden="true" className="size-6" />
        Más
      </button>
      {open && (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-40 animate-fade-in bg-hierro/40" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Más"
            className="neon absolute right-2 bottom-full z-50 mb-2 flex w-72 max-w-[calc(100%-1rem)] origin-bottom-right animate-rise flex-col rounded-2xl bg-asfalto p-1.5"
          >
            {MORE_MODULES.map(({ to, label, description, Icon }) => (
              <button
                key={to}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  void navigate(to)
                }}
                className="flex min-h-14 items-center gap-3 rounded-xl px-2 text-left transition-colors duration-150 hover:bg-concreto/60 focus:bg-concreto/60 focus:outline-none"
              >
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-concreto text-acento"
                >
                  <Icon className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-bold text-arena">{label}</span>
                  <span className="truncate text-xs text-polvo">{description}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-polvo" />
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
