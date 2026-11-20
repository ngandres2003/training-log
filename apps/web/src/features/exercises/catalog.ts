import type { CatalogExercise, CustomExercise, Exercise, Id } from '@training-log/domain'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { listCustomExercises } from '../../data/repositories/exercises'

/** A catalog entry as shipped in /catalog/exercises.es.v1.json (KTD11). */
export interface CatalogEntry extends CatalogExercise {
  nameEn: string
  instructionsEs: string[]
  mediaId: string
}

export const CATALOG_URL = '/catalog/exercises.es.v1.json'

let catalogPromise: Promise<CatalogEntry[]> | null = null

/** Loads the static catalog once per page load. The service worker precaches it, so it works offline. */
export function loadCatalog(fetchImpl: typeof fetch = fetch): Promise<CatalogEntry[]> {
  catalogPromise ??= fetchImpl(CATALOG_URL).then((res) => {
    if (!res.ok) throw new Error(`catalog ${res.status}`)
    return res.json() as Promise<CatalogEntry[]>
  })
  catalogPromise.catch(() => {
    catalogPromise = null // allow a retry after a failure
  })
  return catalogPromise
}

/** Test hook: forget the cached catalog. */
export function resetCatalogCache(): void {
  catalogPromise = null
}

export type CatalogState =
  | { status: 'loading'; catalog: CatalogEntry[] }
  | { status: 'ready'; catalog: CatalogEntry[] }
  | { status: 'unavailable'; catalog: CatalogEntry[] }

export function useCatalog(): CatalogState {
  const [state, setState] = useState<CatalogState>({ status: 'loading', catalog: [] })
  useEffect(() => {
    let alive = true
    loadCatalog().then(
      (catalog) => alive && setState({ status: 'ready', catalog }),
      () => alive && setState({ status: 'unavailable', catalog: [] }),
    )
    return () => {
      alive = false
    }
  }, [])
  return state
}

export function isCustomExercise(exercise: Exercise): exercise is CustomExercise {
  return 'userId' in exercise
}

export interface ExerciseLookup {
  status: CatalogState['status']
  /** Catalog plus the user's custom exercises (live). */
  all: Exercise[]
  byId: Map<Id, Exercise>
}

/** Catalog merged with the user's custom exercises, keyed by id. */
export function useExerciseLookup(): ExerciseLookup {
  const { status, catalog } = useCatalog()
  const custom = useLiveQuery(listCustomExercises, [], [] as CustomExercise[])
  return useMemo(() => {
    const all: Exercise[] = [...catalog, ...custom]
    return { status, all, byId: new Map(all.map((e) => [e.id, e])) }
  }, [status, catalog, custom])
}
