import { UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { SyncIndicator } from './SyncIndicator'

export interface PageHeaderProps {
  title: string
  /** Optional element before the title, e.g. a back button in a child view. */
  leading?: ReactNode
  /** Optional page actions, shown before the sync indicator. */
  actions?: ReactNode
}

/**
 * Header for every tab page and child view: Anton title, the global sync indicator (R6), which the
 * spec places in the header of each tab, and the profile button.
 */
export function PageHeader({ title, leading, actions }: PageHeaderProps) {
  return (
    <header className="flex items-center gap-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
      {leading}
      <h1 className="min-w-0 flex-1 truncate font-display text-3xl uppercase">{title}</h1>
      {actions}
      <SyncIndicator />
      <NavLink
        to="/perfil"
        end
        aria-label="Perfil"
        className={({ isActive }) =>
          `inline-flex size-12 shrink-0 items-center justify-center rounded-full transition-transform duration-150 active:scale-90 ${
            isActive ? 'text-acento' : 'text-arena'
          }`
        }
      >
        <span className="neon-soft flex size-9 items-center justify-center rounded-full bg-asfalto">
          <UserRound aria-hidden="true" className="size-5" />
        </span>
      </NavLink>
    </header>
  )
}
