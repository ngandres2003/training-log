import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { pendingEntries } from '../outbox'
import { TEST_USER, resetDb } from '../testUtils'
import { getSettings, saveSettings } from './settings'

beforeEach(resetDb)

describe('settings repository', () => {
  it('creates one settings row from defaults, then updates that same row', async () => {
    expect(await getSettings()).toBeUndefined()

    const created = await saveSettings({ unit: 'lb' })
    expect(created).toMatchObject({ unit: 'lb', weeklyGoal: 3, userId: TEST_USER.id })

    await saveSettings({ weeklyGoal: 5 })
    expect(await db.settings.count()).toBe(1)
    expect(await getSettings()).toMatchObject({ id: created.id, unit: 'lb', weeklyGoal: 5 })
    expect(await pendingEntries()).toMatchObject([{ key: `settings:${created.id}`, rev: 2 }])
  })
})
