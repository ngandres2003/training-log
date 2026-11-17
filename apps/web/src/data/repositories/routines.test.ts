import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { pendingEntries } from '../outbox'
import { TEST_USER, resetDb } from '../testUtils'
import {
  archiveRoutine,
  createRoutine,
  deleteRoutine,
  getRoutine,
  listArchivedRoutines,
  listInicioRoutines,
  unarchiveRoutine,
  updateRoutine,
} from './routines'
import { listWorkouts, startWorkout } from './workouts'

beforeEach(resetDb)

describe('routines repository', () => {
  it('creating a routine writes the row and one outbox entry', async () => {
    const r = await createRoutine({ name: 'Torso', color: '#ff5500' })

    const stored = await db.routines.get(r.id)
    expect(stored).toMatchObject({
      name: 'Torso',
      color: '#ff5500',
      userId: TEST_USER.id,
      version: 0,
      deletedAt: null,
      archived: false,
      folderId: null,
    })
    expect(r.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/)

    const entries = await pendingEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ table: 'routines', rowId: r.id, rev: 1, row: stored })
  })

  it('editing the same routine twice leaves one entry with the latest row and an incremented rev', async () => {
    const r = await createRoutine({ name: 'Torso' })
    await updateRoutine(r.id, { name: 'Torso A' })
    await updateRoutine(r.id, { notes: 'Pesado' })

    const entries = await pendingEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]?.rev).toBe(3)
    expect(entries[0]?.row).toMatchObject({ name: 'Torso A', notes: 'Pesado' })
    expect(await db.routines.get(r.id)).toMatchObject({ name: 'Torso A', notes: 'Pesado' })
  })

  it('a failed transaction leaves neither the row change nor the outbox entry', async () => {
    const r = await createRoutine({ name: 'Torso' })
    const failOutbox = () => {
      throw new Error('outbox write failed')
    }
    db.outbox.hook('updating', failOutbox)
    try {
      await expect(updateRoutine(r.id, { name: 'Cambiado' })).rejects.toThrow('outbox write failed')
    } finally {
      db.outbox.hook('updating').unsubscribe(failOutbox)
    }

    expect((await db.routines.get(r.id))?.name).toBe('Torso')
    const entries = await pendingEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ rev: 1, row: { name: 'Torso' } })
  })

  it('a failed create stores neither the row nor the outbox entry', async () => {
    const failOutbox = () => {
      throw new Error('outbox write failed')
    }
    db.outbox.hook('creating', failOutbox)
    try {
      await expect(createRoutine({ name: 'Torso' })).rejects.toThrow('outbox write failed')
    } finally {
      db.outbox.hook('creating').unsubscribe(failOutbox)
    }
    expect(await db.routines.count()).toBe(0)
    expect(await pendingEntries()).toEqual([])
  })

  it('deleting a routine hides it from routine lists while its workouts keep the stored name and a deleted flag', async () => {
    const r = await createRoutine({ name: 'Pierna' })
    const other = await createRoutine({ name: 'Torso' })
    const w = await startWorkout({ routineId: r.id, name: 'Pierna' })
    const wOther = await startWorkout({ routineId: other.id, name: 'Torso' })

    await deleteRoutine(r.id)

    expect(await getRoutine(r.id)).toBeUndefined()
    expect((await listInicioRoutines()).map((x) => x.id)).toEqual([other.id])
    expect(await listArchivedRoutines()).toEqual([])
    // Tombstone, not a hard delete, and it is queued for sync.
    expect((await db.routines.get(r.id))?.deletedAt).not.toBeNull()
    const entry = (await pendingEntries()).find((e) => e.rowId === r.id)
    expect(entry?.row.deletedAt).not.toBeNull()

    const workouts = await listWorkouts()
    const byId = new Map(workouts.map((x) => [x.id, x]))
    expect(byId.get(w.id)).toMatchObject({ name: 'Pierna', routineDeleted: true })
    expect(byId.get(wOther.id)).toMatchObject({ name: 'Torso', routineDeleted: false })
  })

  it('archiving a routine excludes it from the Inicio routine list but not from the archived list', async () => {
    const a = await createRoutine({ name: 'A' })
    const b = await createRoutine({ name: 'B' })

    await archiveRoutine(a.id)
    expect((await listInicioRoutines()).map((x) => x.id)).toEqual([b.id])
    expect((await listArchivedRoutines()).map((x) => x.id)).toEqual([a.id])

    await unarchiveRoutine(a.id)
    expect((await listInicioRoutines()).map((x) => x.id).sort()).toEqual([a.id, b.id].sort())
    expect(await listArchivedRoutines()).toEqual([])
  })
})
