import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router'

export function BackLink({ to }: { to: string }) {
  return (
    <Link
      to={to}
      aria-label="Volver"
      className="-ml-3 inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg text-arena"
    >
      <ChevronLeft aria-hidden="true" className="size-7" />
    </Link>
  )
}
