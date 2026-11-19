import { createCustomExercise } from '../../data/repositories/exercises'
import { createFolder } from '../../data/repositories/folders'
import { addRoutineExercise, addRoutineSet, createRoutine } from '../../data/repositories/routines'
import { saveSettings } from '../../data/repositories/settings'
import {
  addWorkoutExercise,
  addWorkoutSet,
  startWorkout,
  updateWorkout,
} from '../../data/repositories/workouts'

/**
 * One account's data covering every reference between rows: folder → routine → routine
 * exercise (custom exercise) → routine set, and workout (from the routine) → workout exercises
 * → sets. Weights are kg.
 */
export async function seedAccount() {
  const settings = await saveSettings({ displayName: 'Ana', unit: 'kg', weeklyGoal: 4 })
  const folder = await createFolder({ name: 'Fuerza', order: 0, isCycle: true })
  const custom = await createCustomExercise({
    name: 'Press en máquina Hammer',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'machine',
    trackingType: 'weight_reps',
    imageUrl: null,
  })
  const routine = await createRoutine({ name: 'Empuje A', color: '#ff0000', folderId: folder.id })
  const re = await addRoutineExercise({
    routineId: routine.id,
    exerciseId: custom.id,
    order: 0,
    supersetGroup: 'g1',
  })
  const rs = await addRoutineSet({
    routineExerciseId: re.id,
    order: 0,
    type: 'normal',
    targetRepsMin: 8,
    targetRepsMax: 10,
    targetWeight: 60,
    targetDurationSec: null,
  })

  const workout = await startWorkout({
    routineId: routine.id,
    name: 'Empuje A',
    startedAt: '2026-11-16T09:00:00.000Z',
  })
  const weCustom = await addWorkoutExercise({
    workoutId: workout.id,
    exerciseId: custom.id,
    routineExerciseId: re.id,
    order: 0,
    note: '',
    supersetGroup: null,
  })
  const wePlank = await addWorkoutExercise({
    workoutId: workout.id,
    exerciseId: 'plank',
    routineExerciseId: null,
    order: 1,
    note: '',
    supersetGroup: null,
  })
  const set = (workoutExerciseId: string, order: number, patch: Record<string, unknown>) =>
    addWorkoutSet({
      workoutExerciseId,
      order,
      type: 'normal',
      weight: null,
      reps: null,
      durationSec: null,
      rpe: null,
      completed: true,
      completedAt: '2026-11-16T09:10:00.000Z',
      ...patch,
    })
  const s1 = await set(weCustom.id, 0, { weight: 60, reps: 8, rpe: 8 })
  const s2 = await set(weCustom.id, 1, { weight: 62.5, reps: 6 })
  const s3 = await set(weCustom.id, 2, {
    weight: 65,
    reps: null,
    completed: false,
    completedAt: null,
  })
  const s4 = await set(wePlank.id, 0, { durationSec: 45 })
  await updateWorkout(workout.id, { status: 'finished', endedAt: '2026-11-16T10:00:00.000Z' })

  return {
    settings,
    folder,
    custom,
    routine,
    re,
    rs,
    workout,
    weCustom,
    wePlank,
    sets: [s1, s2, s3, s4],
  }
}
