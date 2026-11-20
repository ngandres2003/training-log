import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { clearIfRevMatches, outboxKey, pendingEntries } from './outbox'
import { createRoutine, updateRoutine } from './repositories/routines'
import { resetDb } from './testUtils'

beforeEach(resetDb)

describe('outbox', () => {
  it('lists pending entries with the latest row snapshot', async () => {
    const r = await createRoutine({ name: 'Pierna' })
    await updateRoutine(r.id, { name: 'Pierna A' })
    const entries = await pendingEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      key: `routines:${r.id}`,
      table: 'routines',
      rowId: r.id,
      rev: 2,
      row: { id: r.id, name: 'Pierna A' },
    })
  })

  it('clears an entry whose rev still matches the one that was sent', async () => {
    const r = await createRoutine({ name: 'Pierna' })
    const cleared = await clearIfRevMatches(outboxKey('routines', r.id), 1)
    expect(cleared).toBe(true)
    expect(await pendingEntries()).toEqual([])
    // The row itself stays.
    expect((await db.routines.get(r.id))?.name).toBe('Pierna')
  })

  it('keeps an entry whose rev advanced after it was sent', async () => {
    const r = await createRoutine({ name: 'Pierna' })
    const [sent] = await pendingEntries()
    expect(sent?.rev).toBe(1)
    // An edit lands while the push is in flight.
    await updateRoutine(r.id, { name: 'Pierna B' })
    const cleared = await clearIfRevMatches(sent!.key, sent!.rev)
    expect(cleared).toBe(false)
    const entries = await pendingEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ rev: 2, row: { name: 'Pierna B' } })
  })
})
