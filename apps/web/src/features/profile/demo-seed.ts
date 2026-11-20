import type { Id, SetType, SyncTable } from '@training-log/domain'
import { inWriteTransaction, insertRow, updateRow } from '../../data/repositories/base'
import { SESSION_TAGS } from '../sessions/format'

/**
 * Demo data: a PPL program in a cycle folder and about four months of finished workouts on it,
 * so every dashboard (Inicio, Historial, Progreso, ejercicio) has something to show. Rows are
 * written through the outbox like any user edit, so they also sync to the signed-in account.
 * Deterministic for a given `seed`.
 */

interface PlanExercise {
  exerciseId: Id
  /** Working sets (a warm-up is added in front when `warmup`). */
  sets: number
  reps: number
  /** Starting load in kg (added load for bodyweight exercises; seconds for time exercises). */
  start: number
  /** Weekly progression in kg (or seconds). */
  perWeek: number
  /** Load step to round to (2.5 barbell, 1 dumbbell…). */
  step: number
  restSec: number | null
  kind?: 'weight_reps' | 'reps' | 'time'
  warmup?: boolean
  supersetGroup?: string
}

interface PlanRoutine {
  name: string
  color: string
  exercises: PlanExercise[]
}

const PLAN: PlanRoutine[] = [
  {
    name: 'Push',
    color: '#e8b04b',
    exercises: [
      { exerciseId: 'cat-0025', sets: 3, reps: 8, start: 60, perWeek: 1.25, step: 2.5, restSec: 150, warmup: true },
      { exerciseId: 'cat-0314', sets: 3, reps: 10, start: 20, perWeek: 0.5, step: 1, restSec: 90 },
      { exerciseId: 'cat-0091', sets: 3, reps: 8, start: 35, perWeek: 0.6, step: 2.5, restSec: 120 },
      { exerciseId: 'cat-0334', sets: 3, reps: 12, start: 7, perWeek: 0.15, step: 1, restSec: null, supersetGroup: 'push-ss' },
      { exerciseId: 'cat-0201', sets: 3, reps: 12, start: 20, perWeek: 0.5, step: 2.5, restSec: 60, supersetGroup: 'push-ss' },
    ],
  },
  {
    name: 'Pull',
    color: '#5b9bd5',
    exercises: [
      { exerciseId: 'cat-0032', sets: 3, reps: 5, start: 100, perWeek: 2.5, step: 2.5, restSec: 180, warmup: true },
      { exerciseId: 'cat-0652', sets: 3, reps: 6, start: 0, perWeek: 0.6, step: 2.5, restSec: 120, kind: 'reps' },
      { exerciseId: 'cat-0027', sets: 3, reps: 8, start: 50, perWeek: 1, step: 2.5, restSec: 120 },
      { exerciseId: 'cat-0861', sets: 3, reps: 10, start: 45, perWeek: 1, step: 2.5, restSec: 90 },
      { exerciseId: 'cat-0031', sets: 3, reps: 10, start: 25, perWeek: 0.5, step: 2.5, restSec: 60 },
    ],
  },
  {
    name: 'Pierna',
    color: '#7cc47f',
    exercises: [
      { exerciseId: 'cat-0043', sets: 4, reps: 6, start: 80, perWeek: 2, step: 2.5, restSec: 180, warmup: true },
      { exerciseId: 'cat-0085', sets: 3, reps: 8, start: 70, perWeek: 1.5, step: 2.5, restSec: 120 },
      { exerciseId: 'cat-0739', sets: 3, reps: 10, start: 140, perWeek: 4, step: 5, restSec: 120 },
      { exerciseId: 'cat-0599', sets: 3, reps: 12, start: 35, perWeek: 0.75, step: 2.5, restSec: 60 },
      { exerciseId: 'cat-0605', sets: 4, reps: 12, start: 60, perWeek: 1, step: 5, restSec: null },
      { exerciseId: 'cat-2135', sets: 3, reps: 0, start: 45, perWeek: 2, step: 5, restSec: null, kind: 'time' },
    ],
  },
]

/** Free workouts ("Entreno libre") now and then: arms and core, no routine. */
const FREE: PlanExercise[] = [
  { exerciseId: 'cat-0031', sets: 3, reps: 12, start: 22.5, perWeek: 0.4, step: 2.5, restSec: 60 },
  { exerciseId: 'cat-0200', sets: 3, reps: 12, start: 17.5, perWeek: 0.4, step: 2.5, restSec: 60 },
  { exerciseId: 'cat-2135', sets: 2, reps: 0, start: 40, perWeek: 2, step: 5, restSec: null, kind: 'time' },
]

const NOTES = ['Buena sesión', 'Gimnasio lleno, cambié el orden', 'Me noté fuerte', 'Hombro algo cargado', '']

const TABLES: SyncTable[] = ['folders', 'routines', 'routineExercises', 'routineSets', 'workouts', 'workoutExercises', 'workoutSets']

const DAY_MS = 86_400_000

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const roundTo = (value: number, step: number) => Math.max(0, Math.round(value / step) * step)

export interface DemoSeedResult {
  routines: number
  workouts: number
  sets: number
}

export function seedDemoData(options: { now?: Date; months?: number; seed?: number } = {}): Promise<DemoSeedResult> {
  const now = options.now ?? new Date()
  const months = options.months ?? 4
  const random = rng(options.seed ?? 42)
  const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)]!

  return inWriteTransaction(TABLES, async () => {
    const result: DemoSeedResult = { routines: 0, workouts: 0, sets: 0 }
    const createdAt = new Date(now)
    createdAt.setMonth(createdAt.getMonth() - months)
    createdAt.setHours(0, 0, 0, 0)

    const folder = await insertRow('folders', { name: 'Programa PPL (ejemplo)', order: 0, isCycle: true })
    const routines: { id: Id; name: string; links: Map<PlanExercise, Id> }[] = []
    for (const [order, plan] of PLAN.entries()) {
      const routine = await insertRow('routines', {
        name: plan.name,
        color: plan.color,
        folderId: folder.id,
        notes: '',
        order,
        archived: false,
        createdAt: createdAt.toISOString(),
      })
      const links = new Map<PlanExercise, Id>()
      for (const [i, ex] of plan.exercises.entries()) {
        const re = await insertRow('routineExercises', {
          routineId: routine.id,
          exerciseId: ex.exerciseId,
          order: i,
          restSec: ex.restSec,
          note: i === 0 ? 'Calienta bien antes' : '',
          supersetGroup: ex.supersetGroup ?? null,
        })
        links.set(ex, re.id)
        const types: SetType[] = [...(ex.warmup ? ['warmup' as const] : []), ...Array<SetType>(ex.sets).fill('normal')]
        for (const [s, type] of types.entries()) {
          const target = targetOf(ex, 0)
          await insertRow('routineSets', {
            routineExerciseId: re.id,
            order: s,
            type,
            targetRepsMin: ex.kind === 'time' ? null : type === 'warmup' ? 10 : ex.reps,
            targetRepsMax: ex.kind === 'time' ? null : type === 'warmup' ? 10 : ex.reps + 2,
            targetWeight: ex.kind === 'time' ? null : type === 'warmup' ? roundTo(target * 0.5, ex.step) : target,
            targetDurationSec: ex.kind === 'time' ? target : null,
          })
        }
      }
      routines.push({ id: routine.id, name: plan.name, links })
      result.routines += 1
    }

    // Mon / Wed / Fri, some Saturdays; a week off in the middle and a few missed days.
    let next = 0
    const totalDays = Math.round((now.getTime() - createdAt.getTime()) / DAY_MS)
    const vacationWeek = Math.floor(totalDays / 7 / 2)
    for (let d = 1; d < totalDays; d++) {
      const day = new Date(createdAt.getTime() + d * DAY_MS)
      const week = Math.floor(d / 7)
      const dow = day.getDay()
      if (week === vacationWeek) continue
      const free = dow === 6 && random() < 0.35
      if (!free && ![1, 3, 5].includes(dow)) continue
      if (!free && random() < 0.1) continue

      const start = new Date(day)
      start.setHours(17 + Math.floor(random() * 3), Math.floor(random() * 60), 0, 0)
      if (start.getTime() >= now.getTime()) break

      const plan = free ? null : PLAN[next % PLAN.length]!
      const routine = free ? null : routines[next % routines.length]!
      if (!free) next += 1
      const exercises = plan?.exercises ?? FREE

      const workout = await insertRow('workouts', {
        routineId: routine?.id ?? null,
        name: routine?.name ?? 'Entreno libre',
        startedAt: start.toISOString(),
        endedAt: start.toISOString(), // set to the last set below
        status: 'finished',
        energy: 2 + Math.floor(random() * 4),
        tags: random() < 0.25 ? [pick(SESSION_TAGS)] : [],
        note: random() < 0.2 ? pick(NOTES) : '',
        restEndsAt: null,
      })

      let clock = start.getTime() + 5 * 60_000
      const weeks = d / 7
      // Every 5th week is a lighter deload week.
      const deload = Math.floor(weeks) % 5 === 4 ? 0.9 : 1
      for (const [i, ex] of exercises.entries()) {
        // Sometimes an accessory is skipped (shows up as a routine change).
        if (i >= 3 && random() < 0.08) continue
        const we = await insertRow('workoutExercises', {
          workoutId: workout.id,
          exerciseId: ex.exerciseId,
          routineExerciseId: routine?.links.get(ex) ?? null,
          order: i,
          restSec: ex.restSec,
          note: random() < 0.05 ? 'Agarre más cerrado hoy' : '',
          supersetGroup: ex.supersetGroup ?? null,
        })
        const target = targetOf(ex, weeks) * deload
        const types: SetType[] = [...(ex.warmup ? ['warmup' as const] : []), ...Array<SetType>(ex.sets).fill('normal')]
        for (const [s, type] of types.entries()) {
          const last = s === types.length - 1
          const setType: SetType = last && random() < 0.15 ? 'failure' : type
          const values = setValues(ex, setType, target, random)
          clock += (ex.restSec ?? 45) * 1000 + 40_000 + Math.floor(random() * 30_000)
          await insertRow('workoutSets', {
            workoutExerciseId: we.id,
            order: s,
            type: setType,
            ...values,
            rpe: setType === 'normal' && random() < 0.3 ? 7 + Math.floor(random() * 6) / 2 : null,
            completed: true,
            completedAt: new Date(clock).toISOString(),
          })
          result.sets += 1
        }
      }
      await updateRow('workouts', workout.id, { endedAt: new Date(clock + 3 * 60_000).toISOString() })
      result.workouts += 1
    }
    return result
  })
}

/** The load (kg) or duration (s) planned after `weeks` of progression. */
function targetOf(ex: PlanExercise, weeks: number): number {
  return roundTo(ex.start + ex.perWeek * weeks, ex.step)
}

function setValues(ex: PlanExercise, type: SetType, target: number, random: () => number) {
  const noise = () => Math.round((random() - 0.5) * 2)
  if (ex.kind === 'time') {
    return { weight: null, reps: null, durationSec: Math.max(15, Math.round(target + noise() * 5)) }
  }
  if (type === 'warmup') {
    return { weight: ex.kind === 'reps' ? null : roundTo(target * 0.5, ex.step), reps: 10, durationSec: null }
  }
  const reps = Math.max(1, ex.reps + noise() + (type === 'failure' ? 1 : 0))
  const weight = ex.kind === 'reps' ? (target > 0 ? target : null) : roundTo(target, ex.step)
  return { weight, reps, durationSec: null }
}
