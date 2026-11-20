import {
  completedSetsByDay,
  isWorkingSet,
  type DayKey,
  type Id,
  type Settings,
} from '@training-log/domain'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../data/db'
import { DEFAULT_SETTINGS, getSettings } from '../../data/repositories/settings'
import { listWorkouts } from '../../data/repositories/workouts'
import { dayOf, deviceTimeZone, workoutMinutes } from '../routines/format'

/** A finished workout as V9 lists it. */
export interface HistorySession {
  id: Id
  routineId: Id | null
  /** The copied routine name, with " (eliminada)" when the routine was deleted (R12). */
  title: string
  startedAt: string
  day: DayKey
  minutes: number | null
  /** Completed working sets. */
  sets: number
  /** Routine color for the month dots; null for free workouts. */
  color: string | null
}

export interface HistoryData {
  settings: Pick<Settings, 'weekStart' | 'weeklyGoal'>
  /** Newest first. */
  sessions: HistorySession[]
  /** Completed working sets per local day (heatmap input, R27). */
  setsByDay: Map<DayKey, number>
}

async function loadHistory(): Promise<HistoryData> {
  const [all, settings, workoutExercises, workoutSets, routines] = await Promise.all([
    listWorkouts(),
    getSettings(),
    db.workoutExercises.toArray(),
    db.workoutSets.toArray(),
    // Deleted routines too: their sessions keep the routine's color.
    db.routines.toArray(),
  ])
  const workouts = all.filter((w) => w.status === 'finished')
  const colorById = new Map(routines.map((r) => [r.id, r.color]))

  const workoutByExercise = new Map<Id, Id>()
  for (const e of workoutExercises) if (!e.deletedAt) workoutByExercise.set(e.id, e.workoutId)
  const setsByWorkout = new Map<Id, number>()
  for (const s of workoutSets) {
    const workoutId = workoutByExercise.get(s.workoutExerciseId)
    if (!workoutId || s.deletedAt || !s.completed || !isWorkingSet(s)) continue
    setsByWorkout.set(workoutId, (setsByWorkout.get(workoutId) ?? 0) + 1)
  }

  return {
    settings: settings ?? DEFAULT_SETTINGS,
    sessions: workouts.map((w) => ({
      id: w.id,
      routineId: w.routineId,
      title: w.routineDeleted ? `${w.name} (eliminada)` : w.name,
      startedAt: w.startedAt,
      day: dayOf(w.startedAt),
      minutes: workoutMinutes(w),
      sets: setsByWorkout.get(w.id) ?? 0,
      color: w.routineId ? (colorById.get(w.routineId) ?? null) : null,
    })),
    setsByDay: completedSetsByDay({ workouts, workoutExercises, workoutSets }, deviceTimeZone()),
  }
}

/** Live V9 data: finished sessions and the per-day set counts. Undefined while loading. */
export function useHistoryData(): HistoryData | undefined {
  return useLiveQuery(loadHistory, [])
}
