import {
  displayWeight,
  localDayKey,
  SYNC_TABLES,
  type Id,
  type SyncRowByTable,
  type SyncTable,
} from '@training-log/domain'
import { listLive } from '../../data/repositories/base'
import { getSettings } from '../../data/repositories/settings'
import { getLastKnownUser } from '../../data/syncMeta'

export const EXPORT_FORMAT = 'training-log-export'
export const EXPORT_FORMAT_VERSION = 1

/** The JSON export (R8): every live row of every synced table, settings included. */
export interface ExportFile {
  format: typeof EXPORT_FORMAT
  formatVersion: typeof EXPORT_FORMAT_VERSION
  exportedAt: string
  /** Account the rows belong to; import keeps ids only when it matches the signed-in user. */
  userId: Id
  tables: { [T in SyncTable]: SyncRowByTable[T][] }
}

export async function buildJsonExport(): Promise<ExportFile> {
  const user = await getLastKnownUser()
  if (!user) throw new Error('No signed-in user on this device')
  const tables = {} as { [T in SyncTable]: SyncRowByTable[T][] }
  for (const t of SYNC_TABLES) {
    ;(tables as Record<SyncTable, unknown>)[t] = await listLive(t)
  }
  return {
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    userId: user.id,
    tables,
  }
}

export interface CsvExportOptions {
  /** Exercise name (catalog or custom); the id is written when it returns nothing. */
  exerciseName: (id: Id) => string | undefined
  /** IANA zone for the date column; defaults to the device's. */
  timeZone?: string
}

function csvField(value: string | number | null): string {
  if (value === null) return ''
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * CSV for spreadsheets: one row per completed set of finished workouts, in session, exercise and
 * set order. Weight is in the user's unit; duration in seconds. Starts with a UTF-8 BOM so
 * spreadsheet apps read accents correctly.
 */
export async function buildCsvExport({
  exerciseName,
  timeZone,
}: CsvExportOptions): Promise<string> {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const unit = (await getSettings())?.unit ?? 'kg'
  const workouts = (await listLive('workouts', (w) => w.status === 'finished')).sort((a, b) =>
    a.startedAt.localeCompare(b.startedAt),
  )
  const workoutIds = new Set(workouts.map((w) => w.id))
  const exercises = await listLive('workoutExercises', (we) => workoutIds.has(we.workoutId))
  const sets = await listLive('workoutSets', (s) => s.completed)

  const lines = [
    ['Fecha', 'Rutina', 'Ejercicio', `Peso (${unit})`, 'Reps', 'Duración (s)', 'RPE'].join(','),
  ]
  for (const w of workouts) {
    const day = localDayKey(w.startedAt, zone)
    const wes = exercises.filter((we) => we.workoutId === w.id).sort((a, b) => a.order - b.order)
    for (const we of wes) {
      const name = exerciseName(we.exerciseId) ?? we.exerciseId
      const weSets = sets
        .filter((s) => s.workoutExerciseId === we.id)
        .sort((a, b) => a.order - b.order)
      for (const s of weSets) {
        const weight = s.weight === null ? null : displayWeight(s.weight, unit)
        lines.push(
          [day, w.name, name, weight, s.reps, s.durationSec, s.rpe].map(csvField).join(','),
        )
      }
    }
  }
  return `\uFEFF${lines.join('\r\n')}`
}

/** Saves `content` as a file through a temporary object URL. */
export function downloadFile(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
