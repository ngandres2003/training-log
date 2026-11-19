import type { ReactNode } from 'react'

export interface ToastProps {
  children: ReactNode
  /** Optional action, e.g. "Actualizar". Nothing happens until it is tapped. */
  action?: { label: string; onClick: () => void }
}

/** A polite, non-blocking message card; place it in the layout's bottom stack. */
export function Toast({ children, action }: ToastProps) {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-xl border border-borde-fuerte bg-asfalto py-1 pr-1 pl-4 text-sm text-arena shadow-lg"
    >
      <span>{children}</span>
      {action && (
        <button type="button" onClick={action.onClick} className="min-h-12 min-w-12 rounded-lg px-4 font-bold text-sol">
          {action.label}
        </button>
      )}
    </div>
  )
}
