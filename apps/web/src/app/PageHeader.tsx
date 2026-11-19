import type { ReactNode } from 'react'
import { SyncIndicator } from './SyncIndicator'

export interface PageHeaderProps {
  title: string
  /** Optional element before the title, e.g. a back button in a child view. */
  leading?: ReactNode
  /** Optional page actions, shown before the sync indicator. */
  actions?: ReactNode
}

/**
 * Header for every tab page and child view: Anton title plus the global sync indicator (R6),
 * which the spec places in the header of each tab.
 */
export function PageHeader({ title, leading, actions }: PageHeaderProps) {
  return (
    <header className="flex items-center gap-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
      {leading}
      <h1 className="min-w-0 flex-1 truncate font-display text-3xl uppercase">{title}</h1>
      {actions}
      <SyncIndicator />
    </header>
  )
}
