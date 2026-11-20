import { CalendarDays, ChartLine, House, User, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'

const TABS: { to: string; label: string; Icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Inicio', Icon: House, end: true },
  { to: '/historial', label: 'Historial', Icon: CalendarDays },
  { to: '/progreso', label: 'Progreso', Icon: ChartLine },
  { to: '/perfil', label: 'Perfil', Icon: User },
]

/** Bottom tab bar (spec navigation): 4 tabs, 48 px targets, active tab in Sol with a top bar. */
export function TabBar() {
  return (
    <nav aria-label="Pestañas" className="border-t border-concreto bg-hierro pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {TABS.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-2 text-xs ${
                  isActive ? 'border-sol font-bold text-sol' : 'border-transparent text-polvo'
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
