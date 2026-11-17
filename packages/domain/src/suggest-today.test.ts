import { describe, expect, it } from 'vitest'
import { suggestToday } from './suggest-today'
import { folder, routine, workout } from './test-fixtures'

const done = (routineId: string, startedAt: string) => workout({ routineId, startedAt })

describe('suggestToday (R10)', () => {
  const ppl = folder({ id: 'ppl', isCycle: true, order: 0 })
  const push = routine({ id: 'push', name: 'Push', folderId: 'ppl', order: 0 })
  const pull = routine({ id: 'pull', name: 'Pull', folderId: 'ppl', order: 1 })
  const legs = routine({ id: 'legs', name: 'Legs', folderId: 'ppl', order: 2 })

  it('Covers AE3. PPL cycle Push → Pull → Legs with Pull last suggests Legs', () => {
    const result = suggestToday({
      folders: [ppl],
      routines: [legs, push, pull],
      workouts: [done('push', '2026-01-01T10:00:00Z'), done('pull', '2026-01-03T10:00:00Z')],
    })
    expect(result?.name).toBe('Legs')
  })

  it('wraps around to the first routine after the last one of the cycle', () => {
    const result = suggestToday({
      folders: [ppl],
      routines: [push, pull, legs],
      workouts: [done('legs', '2026-01-03T10:00:00Z')],
    })
    expect(result?.id).toBe('push')
  })

  it('with two cycle folders, follows the cycle trained most recently', () => {
    const ul = folder({ id: 'ul', isCycle: true, order: 1 })
    const upper = routine({ id: 'upper', folderId: 'ul', order: 0 })
    const lower = routine({ id: 'lower', folderId: 'ul', order: 1 })
    const result = suggestToday({
      folders: [ppl, ul],
      routines: [push, pull, legs, upper, lower],
      workouts: [done('upper', '2026-01-05T10:00:00Z'), done('push', '2026-01-04T10:00:00Z')],
    })
    expect(result?.id).toBe('lower')
  })

  it('skips archived routines inside a cycle', () => {
    const result = suggestToday({
      folders: [ppl],
      routines: [push, pull, { ...legs, archived: true }],
      workouts: [done('pull', '2026-01-03T10:00:00Z')],
    })
    expect(result?.id).toBe('push')
  })

  it('suggests the first routine of a cycle folder that was never trained', () => {
    const result = suggestToday({ folders: [ppl], routines: [pull, legs, push], workouts: [] })
    expect(result?.id).toBe('push')
  })

  it('with no cycle folders, suggests the oldest-trained routine, never-done routines first', () => {
    const a = routine({ id: 'a', order: 0 })
    const b = routine({ id: 'b', order: 1 })
    const c = routine({ id: 'c', order: 2 })
    expect(
      suggestToday({
        folders: [folder({ id: 'f', isCycle: false })],
        routines: [a, b, c],
        workouts: [
          done('a', '2026-01-01T10:00:00Z'),
          done('b', '2026-01-02T10:00:00Z'),
          done('a', '2026-01-04T10:00:00Z'),
        ],
      })?.id,
    ).toBe('c')
    expect(
      suggestToday({
        folders: [],
        routines: [a, b],
        workouts: [done('a', '2026-01-04T10:00:00Z'), done('b', '2026-01-02T10:00:00Z')],
      })?.id,
    ).toBe('b')
  })

  it('never suggests archived or deleted routines', () => {
    const a = routine({ id: 'a', archived: true })
    const b = routine({ id: 'b', deletedAt: '2026-01-01T00:00:00Z' })
    const c = routine({ id: 'c' })
    expect(
      suggestToday({ folders: [], routines: [a, b, c], workouts: [done('c', '2026-01-01T10:00:00Z')] })
        ?.id,
    ).toBe('c')
    expect(suggestToday({ folders: [], routines: [a, b], workouts: [] })).toBeNull()
  })
})
