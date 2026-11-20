import type { Folder, Id } from '@training-log/domain'
import { db } from '../db'
import { byOrder, getLive, inWriteTransaction, insertRow, listLive, softDeleteRows, updateRow, type RowPatch } from './base'

export function createFolder(input: { name: string; order: number; isCycle?: boolean }): Promise<Folder> {
  return insertRow('folders', { name: input.name, order: input.order, isCycle: input.isCycle ?? false })
}

export function updateFolder(id: Id, patch: RowPatch<'folders'>): Promise<Folder> {
  return updateRow('folders', id, patch)
}

/** Tombstones the folder; its routines stay, without a folder. */
export function deleteFolder(id: Id): Promise<void> {
  return inWriteTransaction(['folders', 'routines'], async () => {
    const routines = await db.routines.where('folderId').equals(id).toArray()
    for (const r of routines) {
      if (r.deletedAt === null) await updateRow('routines', r.id, { folderId: null })
    }
    await softDeleteRows('folders', [id])
  })
}

export function getFolder(id: Id): Promise<Folder | undefined> {
  return getLive('folders', id)
}

export async function listFolders(): Promise<Folder[]> {
  return (await listLive('folders')).sort(byOrder)
}
