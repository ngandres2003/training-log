import { CalendarDays, ChartLine, House, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'
import { MoreMenu } from '../features/more/MoreMenu'

const TABS: { to: string; label: string; Icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Inicio', Icon: House, end: true },
  { to: '/historial', label: 'Historial', Icon: CalendarDays },
  { to: '/progreso', label: 'Progreso', Icon: ChartLine },
]

const tabClass = (active: boolean) =>
  `flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-2 text-xs transition-[color,background-color,transform] duration-200 active:scale-95 active:bg-concreto/40 ${
    active ? 'border-sol font-bold text-acento' : 'border-transparent text-polvo'
  }`

/**
 * Bottom tab bar (spec navigation): 3 tabs plus "Más" (a dropdown of modules), 48 px targets,
 * active tab in Sol with a top bar. Perfil is reached from the page header and from "Más".
 */
export function TabBar() {
  return (
    <nav aria-label="Pestañas" className="relative border-t border-concreto bg-hierro pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {TABS.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} className={({ isActive }) => tabClass(isActive)}>
              <Icon aria-hidden="true" className="size-6" />
              {label}
            </NavLink>
          </li>
        ))}
        <li>
          <MoreMenu tabClassName={tabClass} />
        </li>
      </ul>
    </nav>
  )
}
