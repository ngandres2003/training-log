/** Builders for test data. Only imported by `*.test.ts` files. */
import type {
  Folder,
  Routine,
  RoutineExercise,
  RoutineSet,
  SyncFields,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from './types'

let seq = 0
const nextId = (prefix: string) => `${prefix}-${++seq}`

const sync = (prefix: string, id?: string): SyncFields => ({
  id: id ?? nextId(prefix),
  userId: 'user-1',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  version: 1,
})

export const folder = (p: Partial<Folder> = {}): Folder => ({
  ...sync('folder', p.id),
  name: 'Carpeta',
  order: 0,
  isCycle: false,
  ...p,
})

export const routine = (p: Partial<Routine> = {}): Routine => ({
  ...sync('routine', p.id),
  name: 'Rutina',
  color: '#fff',
  folderId: null,
  notes: '',
  order: 0,
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...p,
})

export const routineExercise = (p: Partial<RoutineExercise> = {}): RoutineExercise => ({
  ...sync('rex', p.id),
  routineId: 'routine',
  exerciseId: 'squat',
  order: 0,
  restSec: null,
  note: '',
  supersetGroup: null,
  ...p,
})

export const routineSet = (p: Partial<RoutineSet> = {}): RoutineSet => ({
  ...sync('rset', p.id),
  routineExerciseId: 'rex',
  order: 0,
  type: 'normal',
  targetRepsMin: null,
  targetRepsMax: null,
  targetWeight: null,
  targetDurationSec: null,
  ...p,
})

export const workout = (p: Partial<Workout> = {}): Workout => ({
  ...sync('workout', p.id),
  routineId: null,
  name: 'Entreno',
  startedAt: '2026-01-01T10:00:00.000Z',
  endedAt: '2026-01-01T11:00:00.000Z',
  status: 'finished',
  energy: null,
  tags: [],
  note: '',
  restEndsAt: null,
  ...p,
})

export const workoutExercise = (p: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  ...sync('wex', p.id),
  workoutId: 'workout',
  exerciseId: 'squat',
  routineExerciseId: null,
  order: 0,
  note: '',
  supersetGroup: null,
  ...p,
})

export const workoutSet = (p: Partial<WorkoutSet> = {}): WorkoutSet => ({
  ...sync('wset', p.id),
  workoutExerciseId: 'wex',
  order: 0,
  type: 'normal',
  weight: null,
  reps: null,
  durationSec: null,
  rpe: null,
  completed: true,
  completedAt: null,
  ...p,
})

export interface SessionSpec {
  routineId?: string | null
  startedAt: string
  exerciseId?: string
  sets: Partial<WorkoutSet>[]
  status?: Workout['status']
}

/** Builds the three workout tables from a compact list of sessions of one exercise each. */
export function history(sessions: SessionSpec[]) {
  const workouts: Workout[] = []
  const workoutExercises: WorkoutExercise[] = []
  const workoutSets: WorkoutSet[] = []
  for (const s of sessions) {
    const w = workout({
      routineId: s.routineId ?? null,
      startedAt: s.startedAt,
      status: s.status ?? 'finished',
    })
    const we = workoutExercise({ workoutId: w.id, exerciseId: s.exerciseId ?? 'squat' })
    workouts.push(w)
    workoutExercises.push(we)
    s.sets.forEach((set, i) =>
      workoutSets.push(workoutSet({ workoutExerciseId: we.id, order: i, ...set })),
    )
  }
  return { workouts, workoutExercises, workoutSets }
}
