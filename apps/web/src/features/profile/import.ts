import { SYNC_TABLES, type Id, type SyncRowByTable, type SyncTable } from '@training-log/domain'
import { newId, nowIso } from '../../data/ids'
import { writeRow } from '../../data/outbox'
import { inWriteTransaction } from '../../data/repositories/base'
import { getSettings } from '../../data/repositories/settings'
import { getLastKnownUser } from '../../data/syncMeta'
import { EXPORT_FORMAT, EXPORT_FORMAT_VERSION, type ExportFile } from './export'

export class InvalidExportError extends Error {
  constructor() {
    super('Not a training-log export')
  }
}

/** Parses a JSON export, refusing anything that is not one this app wrote. */
export function parseExport(text: string): ExportFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new InvalidExportError()
  }
  const file = data as Partial<ExportFile> | null
  if (
    !file ||
    file.format !== EXPORT_FORMAT ||
    file.formatVersion !== EXPORT_FORMAT_VERSION ||
    typeof file.userId !== 'string' ||
    typeof file.tables !== 'object' ||
    file.tables === null ||
    !SYNC_TABLES.every((t) => Array.isArray(file.tables![t]))
  ) {
    throw new InvalidExportError()
  }
  return file as ExportFile
}

export interface ImportResult {
  mode: 'same-account' | 'other-account'
  rows: number
}

/** Id fields that point at another row of the export, per table. */
const REFERENCES: { [T in SyncTable]?: (keyof SyncRowByTable[T])[] } = {
  routines: ['folderId'],
  routineExercises: ['routineId', 'exerciseId'],
  routineSets: ['routineExerciseId'],
  workouts: ['routineId'],
  workoutExercises: ['workoutId', 'exerciseId', 'routineExerciseId'],
  workoutSets: ['workoutExerciseId'],
}

/**
 * Writes an export into the signed-in account through the outbox, so every row syncs (R8).
 * - Same account: rows keep their ids (and overwrite local copies).
 * - Other account: every row gets a new id and every reference between rows is rewritten, since
 *   the server refuses ids owned by another account. Catalog exercise ids are left as they are.
 * Settings are one row per user: they merge into this device's settings row when it has one.
 */
export async function importExport(file: ExportFile): Promise<ImportResult> {
  const user = await getLastKnownUser()
  if (!user) throw new Error('No signed-in user on this device')
  const sameAccount = file.userId === user.id

  const idMap = new Map<Id, Id>()
  if (!sameAccount) {
    for (const t of SYNC_TABLES) for (const row of file.tables[t]) idMap.set(row.id, newId())
  }
  const mapId = (id: Id) => idMap.get(id) ?? id

  let rows = 0
  await inWriteTransaction([...SYNC_TABLES], async () => {
    const existingSettings = await getSettings()
    const at = nowIso()
    for (const t of SYNC_TABLES) {
      for (const source of file.tables[t]) {
        const row: Record<string, unknown> = { ...source, id: mapId(source.id) }
        for (const field of (REFERENCES[t] ?? []) as string[]) {
          const ref = row[field]
          if (typeof ref === 'string') row[field] = mapId(ref)
        }
        if (t === 'settings' && existingSettings) {
          row.id = existingSettings.id
          row.onboardedAt = existingSettings.onboardedAt ?? row.onboardedAt
        }
        Object.assign(row, { userId: user.id, updatedAt: at, deletedAt: null, version: 0 })
        await writeRow(t, row as unknown as SyncRowByTable[typeof t])
        rows += 1
      }
    }
  })
  return { mode: sameAccount ? 'same-account' : 'other-account', rows }
}
