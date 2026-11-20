import { describe, expect, it } from 'vitest'
import { completedSetsByDay, heatmapLevel, heatmapThresholds } from './heatmap'
import { history } from './test-fixtures'

describe('completedSetsByDay', () => {
  it('counts completed working sets of finished workouts per local day, across tracking types', () => {
    const data = history([
      {
        startedAt: '2026-01-01T23:30:00Z',
        sets: [{ reps: 5 }, { reps: 5 }, { reps: 5, completed: false }, { reps: 10, type: 'warmup' }],
      },
      { exerciseId: 'plank', startedAt: '2026-01-02T08:00:00Z', sets: [{ durationSec: 60 }] },
      { startedAt: '2026-01-03T08:00:00Z', sets: [{ reps: 5 }], status: 'active' },
    ])
    const byDay = completedSetsByDay(data, 'Europe/Madrid')
    expect(Object.fromEntries(byDay)).toEqual({ '2026-01-02': 3 })
  })
})

describe('heatmap levels (R27)', () => {
  it('uses fixed thresholds while history is short: 0 empty, 1–5, 6–11, 12–17, 18+', () => {
    const th = heatmapThresholds([3, 10, 20])
    expect([0, 1, 5, 6, 11, 12, 17, 18, 40].map((c) => heatmapLevel(c, th))).toEqual([
      0, 1, 1, 2, 2, 3, 3, 4, 4,
    ])
  })

  it('with enough history, gives 0 sets the empty level, the top days level 4 and the lowest level 1', () => {
    // 20 training days with 30..49 sets: all would be level 4 on fixed thresholds
    const counts = Array.from({ length: 20 }, (_, i) => 30 + i)
    const th = heatmapThresholds(counts)
    expect(heatmapLevel(0, th)).toBe(0)
    expect(heatmapLevel(49, th)).toBe(4)
    expect(heatmapLevel(48, th)).toBe(4)
    expect(heatmapLevel(30, th)).toBe(1)
    expect(heatmapLevel(40, th)).toBe(3)
  })

  it('falls back to fixed thresholds when every day has the same count', () => {
    const th = heatmapThresholds(Array.from({ length: 30 }, () => 8))
    expect(heatmapLevel(8, th)).toBe(2)
  })
})
