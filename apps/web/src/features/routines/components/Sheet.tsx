import { useId, type ReactNode } from 'react'
import { Button } from '../../../ui/Button'

/** Bottom sheet dialog over the page. `alert` is for confirmations of destructive actions. */
export function Sheet({
  title,
  description,
  alert = false,
  children,
}: {
  title: string
  description?: string
  alert?: boolean
  children: ReactNode
}) {
  const titleId = useId()
  const textId = useId()
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-hierro/80">
      <section
        role={alert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? textId : undefined}
        className="flex max-h-[85dvh] w-full max-w-[480px] flex-col gap-4 overflow-y-auto rounded-t-2xl bg-asfalto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <h2 id={titleId} className="font-display text-2xl uppercase">
          {title}
        </h2>
        {description && (
          <p id={textId} className="text-polvo">
            {description}
          </p>
        )}
        {children}
      </section>
    </div>
  )
}

/** Confirmation for a destructive action: Cancelar / `confirmLabel`. */
export function ConfirmSheet({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  tone = 'danger',
}: {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  /** `danger` for destructive actions (red); `primary` for a plain confirmation. */
  tone?: 'danger' | 'primary'
}) {
  return (
    <Sheet title={title} description={description} alert>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel} autoFocus>
          Cancelar
        </Button>
        <Button className={tone === 'danger' ? 'flex-1 !bg-[#e05d5d] !text-arena' : 'flex-1'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  )
}
