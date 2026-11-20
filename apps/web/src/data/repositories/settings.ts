import type { Settings } from '@training-log/domain'
import { insertRow, inWriteTransaction, listLive, updateRow, type RowInput, type RowPatch } from './base'

export const DEFAULT_SETTINGS: RowInput<'settings'> = {
  displayName: '',
  unit: 'kg',
  weeklyGoal: 3,
  weekStart: 'monday',
  theme: 'light',
  preloadPrevious: true,
  soundOn: true,
  vibrationOn: true,
  keepScreenOn: true,
  onboardedAt: null,
}

/** The user's settings row, if one exists on this device. */
export async function getSettings(): Promise<Settings | undefined> {
  const rows = await listLive('settings')
  return rows[0]
}

/** Updates the settings row, creating it from defaults when the device has none yet. */
export function saveSettings(patch: RowPatch<'settings'>): Promise<Settings> {
  return inWriteTransaction(['settings'], async () => {
    const current = await getSettings()
    if (current) return updateRow('settings', current.id, patch)
    return insertRow('settings', { ...DEFAULT_SETTINGS, ...patch })
  })
}
