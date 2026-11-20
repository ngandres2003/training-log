import {
  formatWeightValue,
  parseWeightInput,
  type Id,
  type Routine,
  type SetType,
  type TrackingType,
  type WeightUnit,
} from '@training-log/domain'
import { newId } from '../../data/ids'
import { inWriteTransaction } from '../../data/repositories/base'
import { createFolder, listFolders } from '../../data/repositories/folders'
import {
  addRoutineExercise,
  addRoutineSet,
  createRoutine,
  getRoutine,
  listRoutineExercises,
  listRoutineSets,
  removeRoutineExercise,
  removeRoutineSet,
  updateRoutine,
  updateRoutineExercise,
  updateRoutineSet,
} from '../../data/repositories/routines'

const ROUTINE_TABLES = ['folders', 'routines', 'routineExercises', 'routineSets'] as const

/** Moves the item at `from` to `to`, returning a new array. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item as T)
  return next
}

// Editor draft (V3). Inputs are kept as text in the user's unit until saved.

export interface DraftSet {
  key: string
  id: Id | null
  type: SetType
  repsMin: string
  repsMax: string
  /** Weight (weight_reps) or added load (reps), in the user's unit. */
  weight: string
  durationSec: string
}

export interface DraftExercise {
  key: string
  id: Id | null
  exerciseId: Id
  restSec: string
  note: string
  /** Grouped in a superset with the next exercise. */
  supersetNext: boolean
  sets: DraftSet[]
}

export interface RoutineDraft {
  id: Id | null
  name: string
  color: string
  /** '' = Sin carpeta; 'new' = create a folder named `newFolderName`. */
  folderId: Id | '' | 'new'
  newFolderName: string
  notes: string
  exercises: DraftExercise[]
}

export const ROUTINE_COLORS = [
  { value: '#f6c026', label: 'Amarillo' },
  { value: '#3fa7d6', label: 'Azul' },
  { value: '#5cb85c', label: 'Verde' },
  { value: '#e05d5d', label: 'Rojo' },
  { value: '#a77de8', label: 'Morado' },
  { value: '#a39e8f', label: 'Gris' },
] as const

export function emptyDraft(): RoutineDraft {
  return {
    id: null,
    name: '',
    color: ROUTINE_COLORS[0].value,
    folderId: '',
    newFolderName: '',
    notes: '',
    exercises: [],
  }
}

export function newDraftSet(from?: DraftSet): DraftSet {
  return {
    key: newId(),
    id: null,
    type: 'normal',
    repsMin: from?.repsMin ?? '8',
    repsMax: from?.repsMax ?? '12',
    weight: from?.weight ?? '',
    durationSec: from?.durationSec ?? '30',
  }
}

export function newDraftExercise(exerciseId: Id): DraftExercise {
  const first = newDraftSet()
  return {
    key: newId(),
    id: null,
    exerciseId,
    restSec: '',
    note: '',
    supersetNext: false,
    sets: [first, newDraftSet(first), newDraftSet(first)],
  }
}

const numText = (n: number | null) => (n == null ? '' : String(n))

export async function loadDraft(routineId: Id, unit: WeightUnit): Promise<RoutineDraft | null> {
  const routine = await getRoutine(routineId)
  if (!routine) return null
  const exercises = await listRoutineExercises(routineId)
  const draftExercises: DraftExercise[] = []
  for (const [i, ex] of exercises.entries()) {
    const next = exercises[i + 1]
    const sets = await listRoutineSets(ex.id)
    draftExercises.push({
      key: ex.id,
      id: ex.id,
      exerciseId: ex.exerciseId,
      restSec: numText(ex.restSec),
      note: ex.note,
      supersetNext: ex.supersetGroup != null && next?.supersetGroup === ex.supersetGroup,
      sets: sets.map((s) => ({
        key: s.id,
        id: s.id,
        type: s.type,
        repsMin: numText(s.targetRepsMin),
        repsMax: numText(s.targetRepsMax),
        weight: s.targetWeight == null ? '' : formatWeightValue(s.targetWeight, unit),
        durationSec: numText(s.targetDurationSec),
      })),
    })
  }
  return {
    id: routine.id,
    name: routine.name,
    color: routine.color,
    folderId: routine.folderId ?? '',
    newFolderName: '',
    notes: routine.notes,
    exercises: draftExercises,
  }
}

const parseIntOrNull = (text: string) => {
  const n = Number.parseInt(text.trim(), 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Superset group id per exercise: consecutive exercises linked by `supersetNext` share one. */
function supersetGroups(exercises: DraftExercise[]): (string | null)[] {
  let group: string | null = null
  return exercises.map((ex, i) => {
    const linkedFromPrev = i > 0 && exercises[i - 1]!.supersetNext
    if (!linkedFromPrev) group = ex.supersetNext && i < exercises.length - 1 ? newId() : null
    return group
  })
}

/** Writes the draft (new or existing routine) in one transaction; returns the routine. */
export function saveDraft(
  draft: RoutineDraft,
  trackingTypeOf: (exerciseId: Id) => TrackingType,
  unit: WeightUnit,
): Promise<Routine> {
  return inWriteTransaction([...ROUTINE_TABLES], async () => {
    let folderId: Id | null = draft.folderId === '' || draft.folderId === 'new' ? null : draft.folderId
    const folderName = draft.newFolderName.trim()
    if (draft.folderId === 'new' && folderName) {
      const folders = await listFolders()
      const order = folders.reduce((max, f) => Math.max(max, f.order + 1), 0)
      folderId = (await createFolder({ name: folderName, order })).id
    }
    const fields = { name: draft.name.trim(), color: draft.color, folderId, notes: draft.notes.trim() }
    const routine = draft.id ? await updateRoutine(draft.id, fields) : await createRoutine(fields)

    const keptExerciseIds = new Set(draft.exercises.flatMap((e) => (e.id ? [e.id] : [])))
    for (const old of await listRoutineExercises(routine.id)) {
      if (!keptExerciseIds.has(old.id)) await removeRoutineExercise(old.id)
    }

    const groups = supersetGroups(draft.exercises)
    for (const [order, ex] of draft.exercises.entries()) {
      const exFields = {
        order,
        restSec: parseIntOrNull(ex.restSec),
        note: ex.note.trim(),
        supersetGroup: groups[order] ?? null,
      }
      const exerciseRowId = ex.id
        ? (await updateRoutineExercise(ex.id, exFields)).id
        : (await addRoutineExercise({ routineId: routine.id, exerciseId: ex.exerciseId, ...exFields })).id

      const keptSetIds = new Set(ex.sets.flatMap((s) => (s.id ? [s.id] : [])))
      for (const old of await listRoutineSets(exerciseRowId)) {
        if (!keptSetIds.has(old.id)) await removeRoutineSet(old.id)
      }
      const timed = trackingTypeOf(ex.exerciseId) === 'time'
      for (const [setOrder, s] of ex.sets.entries()) {
        const setFields = {
          order: setOrder,
          type: s.type,
          targetRepsMin: timed ? null : parseIntOrNull(s.repsMin),
          targetRepsMax: timed ? null : parseIntOrNull(s.repsMax),
          targetWeight: timed || !s.weight.trim() ? null : parseWeightInput(s.weight, unit),
          targetDurationSec: timed ? parseIntOrNull(s.durationSec) : null,
        }
        if (s.id) await updateRoutineSet(s.id, setFields)
        else await addRoutineSet({ routineExerciseId: exerciseRowId, ...setFields })
      }
    }
    return routine
  })
}

/** Copies a routine with its exercises and sets under new ids, named "<name> (copia)". */
export function duplicateRoutine(routineId: Id): Promise<Routine> {
  return inWriteTransaction([...ROUTINE_TABLES], async () => {
    const source = await getRoutine(routineId)
    if (!source) throw new Error(`routine ${routineId} not found`)
    const copy = await createRoutine({
      name: `${source.name} (copia)`,
      color: source.color,
      folderId: source.folderId,
      notes: source.notes,
    })
    const groupIds = new Map<string, string>()
    for (const ex of await listRoutineExercises(routineId)) {
      let group: string | null = null
      if (ex.supersetGroup) {
        group = groupIds.get(ex.supersetGroup) ?? newId()
        groupIds.set(ex.supersetGroup, group)
      }
      const exCopy = await addRoutineExercise({
        routineId: copy.id,
        exerciseId: ex.exerciseId,
        order: ex.order,
        restSec: ex.restSec,
        note: ex.note,
        supersetGroup: group,
      })
      for (const s of await listRoutineSets(ex.id)) {
        await addRoutineSet({
          routineExerciseId: exCopy.id,
          order: s.order,
          type: s.type,
          targetRepsMin: s.targetRepsMin,
          targetRepsMax: s.targetRepsMax,
          targetWeight: s.targetWeight,
          targetDurationSec: s.targetDurationSec,
        })
      }
    }
    return copy
  })
}

/** Reorders routines inside a folder by moving one, reusing the folder's existing order values. */
export async function reorderRoutines(routines: Routine[], from: number, to: number): Promise<void> {
  const orders = routines.map((r) => r.order).sort((a, b) => a - b)
  const moved = moveItem(routines, from, to)
  await inWriteTransaction(['routines'], async () => {
    for (const [i, r] of moved.entries()) {
      const order = orders[i]!
      if (r.order !== order) await updateRoutine(r.id, { order })
    }
  })
}
