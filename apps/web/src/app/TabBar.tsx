import { CalendarDays, ChartLine, Ellipsis, House, type LucideIcon } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'

const TABS: { to: string; label: string; Icon: LucideIcon; end?: boolean; also?: string[] }[] = [
  { to: '/', label: 'Inicio', Icon: House, end: true },
  { to: '/historial', label: 'Historial', Icon: CalendarDays },
  { to: '/progreso', label: 'Progreso', Icon: ChartLine },
  // Profile lives in the page header; "Más" collects the other modules (and Perfil).
  { to: '/mas', label: 'Más', Icon: Ellipsis, also: ['/perfil'] },
]

/** Bottom tab bar (spec navigation): 4 tabs, 48 px targets, active tab in Sol with a top bar. */
export function TabBar() {
  const { pathname } = useLocation()
  // Pages reached from a tab (e.g. Perfil from Más) keep that tab lit.
  const lit = (also?: string[]) => also?.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? false
  return (
    <nav aria-label="Pestañas" className="border-t border-concreto bg-hierro pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {TABS.map(({ to, label, Icon, end, also }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-2 text-xs transition-colors duration-200 ${
                  isActive || lit(also) ? 'border-sol font-bold text-acento' : 'border-transparent text-polvo'
                }`
              }
            >
              <Icon aria-hidden="true" className="size-6" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
