import type { Equipment } from '@training-log/domain'
import { Cable, Cog, Dumbbell, PersonStanding, Shapes, Weight, type LucideIcon } from 'lucide-react'
import { EQUIPMENT_LABELS } from './exercise-list'

const ICONS: Record<Equipment, LucideIcon> = {
  barbell: Weight,
  dumbbell: Dumbbell,
  machine: Cog,
  cable: Cable,
  bodyweight: PersonStanding,
  other: Shapes,
}

/** Stand-in thumbnail when an exercise has no photo (or it is not cached offline). */
export function EquipmentIcon({ equipment, className = 'size-6' }: { equipment: Equipment; className?: string }) {
  const Icon = ICONS[equipment]
  return <Icon role="img" aria-label={EQUIPMENT_LABELS[equipment]} className={className} />
}
