/**
 * Maps the exercises-dataset muscle names onto the fixed muscle ids in
 * packages/domain/src/muscles.ts (R17). Any value not listed here makes the
 * import fail, so a new dataset release cannot slip in an unknown muscle.
 */
import type { MuscleId } from '../../packages/domain/src/types'

/** Dataset `target` values whose exercises are dropped (cardio is out of scope). */
export const DROPPED_TARGETS: readonly string[] = ['cardiovascular system']

/** Dataset `target` -> primary muscle id. */
export const PRIMARY_MUSCLE_MAP: Readonly<Record<string, MuscleId>> = {
  abs: 'abdominals',
  quads: 'quadriceps',
  lats: 'lats',
  calves: 'calves',
  pectorals: 'chest',
  glutes: 'glutes',
  hamstrings: 'hamstrings',
  adductors: 'adductors',
  abductors: 'abductors',
  triceps: 'triceps',
  biceps: 'biceps',
  forearms: 'forearms',
  traps: 'traps',
  delts: 'shoulders',
  spine: 'lower_back',
  'upper back': 'middle_back',
  // Scapular protraction work (scapula push-ups, incline shoulder raises).
  'serratus anterior': 'chest',
  // Only neck stretches use this target.
  'levator scapulae': 'neck',
}

/**
 * Dataset `secondary_muscles` value -> muscle id, or `null` for body parts
 * that have no place on the muscle map (ankles, feet, hands, shins).
 */
export const SECONDARY_MUSCLE_MAP: Readonly<Record<string, MuscleId | null>> = {
  abdominals: 'abdominals',
  core: 'abdominals',
  obliques: 'abdominals',
  'lower abs': 'abdominals',
  // Rectus femoris is the hip flexor that sits on the muscle map.
  'hip flexors': 'quadriceps',
  quadriceps: 'quadriceps',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',
  soleus: 'calves',
  groin: 'adductors',
  'inner thighs': 'adductors',
  chest: 'chest',
  'upper chest': 'chest',
  shoulders: 'shoulders',
  deltoids: 'shoulders',
  'rear deltoids': 'shoulders',
  'rotator cuff': 'shoulders',
  biceps: 'biceps',
  brachialis: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  wrists: 'forearms',
  'wrist flexors': 'forearms',
  'wrist extensors': 'forearms',
  'grip muscles': 'forearms',
  traps: 'traps',
  trapezius: 'traps',
  lats: 'lats',
  'latissimus dorsi': 'lats',
  back: 'middle_back',
  'upper back': 'middle_back',
  rhomboids: 'middle_back',
  'lower back': 'lower_back',
  sternocleidomastoid: 'neck',
  'ankle stabilizers': null,
  ankles: null,
  feet: null,
  hands: null,
  shins: null,
}

export function mapPrimaryMuscle(target: string): MuscleId {
  const id = Object.hasOwn(PRIMARY_MUSCLE_MAP, target) ? PRIMARY_MUSCLE_MAP[target] : undefined
  if (!id) throw new Error(`Unmapped target muscle "${target}": add it to PRIMARY_MUSCLE_MAP`)
  return id
}

/** Maps, de-duplicates and removes the primary muscle from the secondary list. */
export function mapSecondaryMuscles(values: readonly string[], primary: MuscleId): MuscleId[] {
  const result: MuscleId[] = []
  for (const value of values) {
    if (!Object.hasOwn(SECONDARY_MUSCLE_MAP, value)) {
      throw new Error(`Unmapped secondary muscle "${value}": add it to SECONDARY_MUSCLE_MAP`)
    }
    const id = SECONDARY_MUSCLE_MAP[value]
    if (id && id !== primary && !result.includes(id)) result.push(id)
  }
  return result
}
