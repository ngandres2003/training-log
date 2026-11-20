import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MUSCLES } from '../../packages/domain/src/muscles'

const FIXED = new Set(MUSCLES.map((m) => m.id))
const EQUIPMENT = new Set(['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'other'])
const TRACKING = new Set(['weight_reps', 'reps', 'time'])

const catalogUrl = new URL('../../apps/web/public/catalog/exercises.es.v1.json', import.meta.url)
const catalog = JSON.parse(readFileSync(catalogUrl, 'utf8')) as Record<string, unknown>[]

describe('committed catalog exercises.es.v1.json', () => {
  it('is a non-empty list with unique cat- ids', () => {
    expect(catalog.length).toBeGreaterThan(1000)
    const ids = catalog.map((e) => e.id as string)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^cat-\d+$/)
  })

  it('gives every entry a primary and secondary muscles from the fixed list', () => {
    for (const e of catalog) {
      expect(FIXED.has(e.primaryMuscle as string), `${e.id} primary ${e.primaryMuscle}`).toBe(true)
      for (const m of e.secondaryMuscles as string[]) expect(FIXED.has(m), `${e.id} secondary ${m}`).toBe(true)
    }
  })

  it('uses only the three tracking types and the six equipment groups', () => {
    for (const e of catalog) {
      expect(TRACKING.has(e.trackingType as string), `${e.id} ${e.trackingType}`).toBe(true)
      expect(EQUIPMENT.has(e.equipment as string), `${e.id} ${e.equipment}`).toBe(true)
    }
  })

  it('ships no image URL but keeps the media id', () => {
    for (const e of catalog) {
      expect(e.imageUrl, String(e.id)).toBeNull()
      expect(typeof e.mediaId, String(e.id)).toBe('string')
    }
  })

  it('has a Spanish name, English alias and Spanish instructions for every entry', () => {
    for (const e of catalog) {
      expect((e.name as string).trim().length, String(e.id)).toBeGreaterThan(0)
      expect((e.nameEn as string).trim().length, String(e.id)).toBeGreaterThan(0)
      expect(Array.isArray(e.instructionsEs), String(e.id)).toBe(true)
    }
  })

  it('contains no cardio exercise', () => {
    const names = new Set(catalog.map((e) => e.nameEn))
    expect(names.has('run')).toBe(false)
    expect(names.has('burpee')).toBe(false)
    expect(names.has('walking on stepmill')).toBe(false)
  })

  it('spot-checks known entries', () => {
    const byEn = (n: string) => catalog.find((e) => e.nameEn === n)
    expect(byEn('barbell bench press')).toMatchObject({
      primaryMuscle: 'chest',
      equipment: 'barbell',
      trackingType: 'weight_reps',
    })
    expect(byEn('pull-up')).toMatchObject({ primaryMuscle: 'lats', equipment: 'bodyweight', trackingType: 'reps' })
    expect(byEn('weighted front plank')).toMatchObject({ trackingType: 'time' })
    expect(byEn('smith squat')).toMatchObject({ equipment: 'machine' })
  })
})
