import type { Id } from './types'

export interface SupersetExercise {
  id: Id
  supersetGroup: string | null
  sets: { id: Id; completed: boolean }[]
}

export interface NextSet {
  exerciseId: Id
  setId: Id
  /** 0-based row index within the exercise. */
  setIndex: number
}

/**
 * Next pending set for "Siguiente" (R20). Exercises in workout order; consecutive
 * exercises sharing a superset group form one block that alternates
 * A1 → B1 → A2 → B2. Plain exercises go set by set. Null when all sets are done.
 */
export function nextPendingSet(exercises: SupersetExercise[]): NextSet | null {
  const blocks: SupersetExercise[][] = []
  for (const e of exercises) {
    const current = blocks.at(-1)
    if (current && e.supersetGroup != null && current[0]!.supersetGroup === e.supersetGroup) {
      current.push(e)
    } else {
      blocks.push([e])
    }
  }

  for (const block of blocks) {
    const rounds = Math.max(...block.map((e) => e.sets.length))
    for (let round = 0; round < rounds; round++) {
      for (const e of block) {
        const set = e.sets[round]
        if (set && !set.completed) return { exerciseId: e.id, setId: set.id, setIndex: round }
      }
    }
  }
  return null
}
