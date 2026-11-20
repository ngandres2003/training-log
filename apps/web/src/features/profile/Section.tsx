import { useId, type ReactNode } from 'react'

/** A titled V12 card. */
export function Section({
  id,
  title,
  children,
}: {
  id?: string
  title: string
  children: ReactNode
}) {
  const headingId = useId()
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="flex scroll-mt-4 flex-col gap-3 rounded-xl border border-concreto bg-asfalto p-4"
    >
      <h2 id={headingId} className="font-display text-xl uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}
