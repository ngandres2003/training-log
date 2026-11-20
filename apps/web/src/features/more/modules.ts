import { Dumbbell, UserRound, type LucideIcon } from 'lucide-react'

export interface MoreModule {
  to: string
  label: string
  description: string
  Icon: LucideIcon
}

/** Entries of the "Más" tab. Add new modules here; they show up as cards in this order. */
export const MORE_MODULES: MoreModule[] = [
  { to: '/perfil', label: 'Perfil', description: 'Ajustes, sincronización y tus datos', Icon: UserRound },
  {
    to: '/perfil/ejercicios',
    label: 'Biblioteca de ejercicios',
    description: 'Consulta y crea ejercicios',
    Icon: Dumbbell,
  },
]
