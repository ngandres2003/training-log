import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDb } from '../testUtils'
import { createFolder, deleteFolder, listFolders } from './folders'
import { createRoutine, getRoutine } from './routines'

beforeEach(resetDb)

describe('folders repository', () => {
  it('deleting a folder hides it and keeps its routines without a folder', async () => {
    const f = await createFolder({ name: 'PPL', order: 0, isCycle: true })
    const other = await createFolder({ name: 'Extra', order: 1 })
    const r = await createRoutine({ name: 'Push', folderId: f.id })

    await deleteFolder(f.id)

    expect((await listFolders()).map((x) => x.id)).toEqual([other.id])
    expect(await getRoutine(r.id)).toMatchObject({ name: 'Push', folderId: null })
  })
})
