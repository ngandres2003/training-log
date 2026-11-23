import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Exercise } from '@training-log/domain'
import { describe, expect, it } from 'vitest'
import { BASIC_EXERCISE_IDS } from './basics'
import { filterExercises } from './exercise-list'

const catalog = JSON.parse(
  readFileSync(resolve(__dirname, '../../../public/catalog/exercises.es.v1.json'), 'utf8'),
) as Exercise[]

const noFilters = { query: '', muscle: null, equipment: null, mineOnly: false }

describe('basic exercises', () => {
  it('every id exists in the catalog, once', () => {
    const ids = new Set(catalog.map((e) => e.id))
    expect(BASIC_EXERCISE_IDS.filter((id) => !ids.has(id))).toEqual([])
    expect(new Set(BASIC_EXERCISE_IDS).size).toBe(BASIC_EXERCISE_IDS.length)
  })

  it('come first in curated order, then the rest by name', () => {
    const result = filterExercises(catalog, noFilters)
    const n = BASIC_EXERCISE_IDS.length
    expect(result.slice(0, n).map((e) => e.id)).toEqual(BASIC_EXERCISE_IDS)
    const rest = result.slice(n).map((e) => e.name)
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b, 'es')))
  })

  it('a search puts the basic match on top', () => {
    const [first] = filterExercises(catalog, { ...noFilters, query: 'press banca' })
    expect(first?.name).toBe('Press de banca con barra')
  })
})
