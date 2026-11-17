import { describe, expect, it } from 'vitest'
import { describeChange, diffRoutine } from './routine-diff'
import { routineExercise, routineSet, workoutExercise, workoutSet } from './test-fixtures'

const names: Record<string, string> = { squat: 'Sentadilla', bench: 'Press banca', row: 'Remo' }
const label = (c: Parameters<typeof describeChange>[0], unit: 'kg' | 'lb' = 'kg') =>
  describeChange(c, { exerciseName: (id) => names[id] ?? id, unit })

function template() {
  const squat = routineExercise({ id: 'rex-squat', exerciseId: 'squat', order: 0 })
  const bench = routineExercise({ id: 'rex-bench', exerciseId: 'bench', order: 1 })
  const routineSets = [
    routineSet({ routineExerciseId: 'rex-squat', order: 0, type: 'warmup', targetWeight: 40 }),
    routineSet({ routineExerciseId: 'rex-squat', order: 1, targetWeight: 80 }),
    routineSet({ routineExerciseId: 'rex-squat', order: 2, targetWeight: 80 }),
    routineSet({ routineExerciseId: 'rex-bench', order: 0, targetWeight: 60 }),
  ]
  return { routineExercises: [squat, bench], routineSets }
}

function doneAsPlanned() {
  const wSquat = workoutExercise({ id: 'w-squat', exerciseId: 'squat', routineExerciseId: 'rex-squat' })
  const wBench = workoutExercise({
    id: 'w-bench',
    exerciseId: 'bench',
    routineExerciseId: 'rex-bench',
    order: 1,
  })
  const workoutSets = [
    workoutSet({ workoutExerciseId: 'w-squat', order: 0, type: 'warmup', weight: 40, reps: 10 }),
    workoutSet({ workoutExerciseId: 'w-squat', order: 1, weight: 80, reps: 8 }),
    workoutSet({ workoutExerciseId: 'w-squat', order: 2, weight: 80, reps: 8 }),
    workoutSet({ workoutExerciseId: 'w-bench', order: 0, weight: 60, reps: 8 }),
  ]
  return { workoutExercises: [wSquat, wBench], workoutSets }
}

describe('diffRoutine (R24)', () => {
  it('returns no changes when the workout matched the routine', () => {
    expect(diffRoutine({ ...template(), ...doneAsPlanned() })).toEqual([])
  })

  it('lists an added set, a removed exercise and a target weight change from 80 to 82.5 kg', () => {
    const done = doneAsPlanned()
    done.workoutExercises = done.workoutExercises.filter((e) => e.exerciseId !== 'bench')
    done.workoutSets = done.workoutSets.filter((s) => s.workoutExerciseId !== 'w-bench')
    done.workoutSets[2]!.weight = 82.5
    done.workoutSets.push(workoutSet({ workoutExerciseId: 'w-squat', order: 3, weight: 82.5, reps: 6 }))

    const changes = diffRoutine({ ...template(), ...done })
    expect(changes.map((c) => label(c))).toEqual([
      'Sentadilla: serie 3 de 80 a 82,5 kg',
      'Sentadilla: añadir serie 4',
      'Quitar Press banca',
    ])
  })

  it('lists an added exercise, a removed set and a set type change', () => {
    const done = doneAsPlanned()
    done.workoutSets = done.workoutSets.filter((s) => !(s.workoutExerciseId === 'w-squat' && s.order === 2))
    done.workoutSets.find((s) => s.workoutExerciseId === 'w-bench')!.type = 'failure'
    done.workoutExercises.push(workoutExercise({ id: 'w-row', exerciseId: 'row', order: 2 }))
    done.workoutSets.push(workoutSet({ workoutExerciseId: 'w-row', weight: 50, reps: 10 }))

    expect(diffRoutine({ ...template(), ...done }).map((c) => label(c))).toEqual([
      'Sentadilla: quitar serie 3',
      'Press banca: serie 1 de normal a al fallo',
      'Añadir Remo',
    ])
  })

  it('ignores weight differences on warm-up rows and on rows not completed', () => {
    const done = doneAsPlanned()
    done.workoutSets[0]!.weight = 50
    done.workoutSets[1]!.weight = 90
    done.workoutSets[1]!.completed = false
    expect(diffRoutine({ ...template(), ...done })).toEqual([])
  })

  it('shows weights in the user unit', () => {
    const done = doneAsPlanned()
    done.workoutSets[1]!.weight = 82.5
    const [change] = diffRoutine({ ...template(), ...done })
    expect(label(change!, 'lb')).toBe('Sentadilla: serie 2 de 176,4 a 181,9 lb')
  })
})
