import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '../../app/PageHeader'
import { MORE_MODULES } from './modules'

/** "Más" tab: one card per module (see ./modules), the place where new modules are added. */
export function More() {
  return (
    <>
      <PageHeader title="Más" />
      <ul className="flex flex-col gap-3">
        {MORE_MODULES.map(({ to, label, description, Icon }, i) => (
          <li key={to} className="animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
            <Link
              to={to}
              className="neon-soft flex min-h-16 items-center gap-3 rounded-xl bg-asfalto p-3 transition-transform duration-150 active:scale-[0.98]"
            >
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-concreto text-acento"
              >
                <Icon className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-bold">{label}</span>
                <span className="truncate text-sm text-polvo">{description}</span>
              </span>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-polvo" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
