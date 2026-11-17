import { describe, expect, it } from 'vitest'
import { nextPendingSet } from './superset'

const ex = (id: string, group: string | null, done: boolean[]) => ({
  id,
  supersetGroup: group,
  sets: done.map((completed, i) => ({ id: `${id}${i + 1}`, completed })),
})

describe('nextPendingSet (R20)', () => {
  it('Covers AE6. in a bench (A) + row (B) superset, after A1 comes B1, after B1 comes A2', () => {
    expect(
      nextPendingSet([ex('A', 'g', [true, false, false]), ex('B', 'g', [false, false, false])]),
    ).toEqual({ exerciseId: 'B', setId: 'B1', setIndex: 0 })
    expect(
      nextPendingSet([ex('A', 'g', [true, false, false]), ex('B', 'g', [true, false, false])])
        ?.setId,
    ).toBe('A2')
  })

  it('moves to the next exercise block after the last superset round', () => {
    const list = [
      ex('A', 'g', [true, true]),
      ex('B', 'g', [true, true]),
      ex('C', null, [false, false]),
    ]
    expect(nextPendingSet(list)?.setId).toBe('C1')
  })

  it('keeps alternating when one exercise of the superset has more sets', () => {
    const list = [ex('A', 'g', [true, true, false]), ex('B', 'g', [true, true])]
    expect(nextPendingSet(list)?.setId).toBe('A3')
  })

  it('walks a plain exercise set by set and returns null when everything is done', () => {
    expect(nextPendingSet([ex('A', null, [true, false])])?.setId).toBe('A2')
    expect(nextPendingSet([ex('A', null, [true]), ex('B', 'g', [true])])).toBeNull()
  })

  it('treats two separate superset groups as separate blocks', () => {
    const list = [
      ex('A', 'g1', [true]),
      ex('B', 'g1', [true]),
      ex('C', 'g2', [false]),
      ex('D', 'g2', [false]),
    ]
    expect(nextPendingSet(list)?.setId).toBe('C1')
  })
})
