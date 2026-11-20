import 'fake-indexeddb/auto'
import { db } from './db'
import { setLastKnownUser } from './syncMeta'

export const TEST_USER = { id: '0190f0c0-0000-7000-8000-000000000001', email: 'ana@example.com' }

/** Fresh empty database with a signed-in user, for repository tests. */
export async function resetDb(): Promise<void> {
  await db.delete()
  await db.open()
  await setLastKnownUser(TEST_USER)
}
